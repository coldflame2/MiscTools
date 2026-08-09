import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function resolveAndDownloadOnlineExcel(inputUrl: string): Promise<Buffer> {
  let url = inputUrl.trim();

  // 1. Google Sheets / Google Drive direct export transforms
  if (url.includes('docs.google.com/spreadsheets/d/')) {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      url = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`;
    }
  } else if (url.includes('drive.google.com/file/d/')) {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      url = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`;
    }
  }

  // 2. Dropbox link transform
  if (url.includes('dropbox.com')) {
    if (url.includes('dl=0')) {
      url = url.replace('dl=0', 'dl=1');
    } else if (!url.includes('dl=1') && !url.includes('raw=1')) {
      url += (url.includes('?') ? '&' : '?') + 'dl=1';
    }
  }

  // 3. OneDrive / SharePoint link pre-transform
  if ((url.includes('onedrive') || url.includes('sharepoint.com')) && !url.includes('download=1') && !url.includes('download.aspx')) {
    if (url.includes('view.aspx')) {
      url = url.replace('view.aspx', 'download.aspx');
    } else if (url.includes('action=default') || url.includes('action=view')) {
      url = url.replace(/action=(default|view)/, 'action=download');
    }
  }

  let currentUrl = url;
  let cookies: string[] = [];

  const isValidExcelBuffer = (buf: Buffer): boolean => {
    if (!buf || buf.length < 4) return false;
    // Check for ZIP magic bytes (PK\x03\x04) used by XLSX/XLSM/XLSB
    if (buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04) return true;
    // Check for OLE2 compound document magic bytes (\xD0\xCF\x11\xE0) used by binary .XLS
    if (buf[0] === 0xD0 && buf[1] === 0xCF && buf[2] === 0x11 && buf[3] === 0xE0) return true;

    const headText = buf.slice(0, 500).toString('utf8').toLowerCase();
    // Non-HTML text (such as CSV/TSV)
    if (!headText.includes('<!doctype') && !headText.includes('<html') && !headText.includes('<head')) {
      return true;
    }
    return false;
  };

  for (let step = 0; step < 12; step++) {
    console.log(`[Proxy Step ${step}] Fetching: ${currentUrl}`);
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };
    if (cookies.length > 0) {
      headers['Cookie'] = cookies.map(c => c.split(';')[0]).join('; ');
    }

    const res = await fetch(currentUrl, { headers, redirect: 'manual' });
    const setCookies = (res.headers as any).getSetCookie ? (res.headers as any).getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
    if (setCookies && setCookies.length > 0) {
      cookies.push(...setCookies);
    }

    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      currentUrl = new URL(loc, currentUrl).toString();
      continue;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // If buffer is valid binary spreadsheet, return immediately
    if (isValidExcelBuffer(buffer)) {
      return buffer;
    }

    // Unescape HTML response content for deep URL extraction
    let html = buffer.toString('utf8');
    const unescapedHtml = html
      .replace(/\\u002f|\\\/|\\\//gi, '/')
      .replace(/\\u0026/gi, '&')
      .replace(/\\u003a/gi, ':')
      .replace(/\\u003f/gi, '?')
      .replace(/\\u003d/gi, '=')
      .replace(/\\"/g, '"');

    // Strategy A: Find explicit download.aspx or downloadUrl or direct .xlsx links in unescaped HTML
    const extractedUrls: string[] = [];
    const dlMatches = unescapedHtml.match(/https?:[^\s"'<>]*(?:download\.aspx|downloadUrl|getfile|\.xlsx|\.xls)[^\s"'<>]*/gi) || [];
    extractedUrls.push(...dlMatches);

    // Strategy B: Search for JSON key patterns like "downloadUrl":"...", "@content.downloadUrl":"..."
    const jsonKeys = ['downloadUrl', '@content.downloadUrl', 'directUrl', 'fileUrl', 'Url'];
    for (const key of jsonKeys) {
      const regex = new RegExp(`"${key.replace('@', '\\@')}"\\s*:\\s*"([^"]+)"`, 'gi');
      let m;
      while ((m = regex.exec(unescapedHtml)) !== null) {
        if (m[1] && m[1].startsWith('http')) {
          extractedUrls.push(m[1]);
        }
      }
    }

    // Try each extracted URL candidate
    for (const rawCandidate of Array.from(new Set(extractedUrls))) {
      try {
        console.log('[Proxy] Trying extracted candidate URL:', rawCandidate);
        const reqHeaders = { ...headers };
        if (cookies.length > 0) reqHeaders['Cookie'] = cookies.map(c => c.split(';')[0]).join('; ');
        const dlRes = await fetch(rawCandidate, { headers: reqHeaders, redirect: 'follow' });
        const dlBuf = Buffer.from(await dlRes.arrayBuffer());
        if (isValidExcelBuffer(dlBuf)) {
          return dlBuf;
        }
      } catch (e) {
        // continue
      }
    }

    // Strategy C: Extract GUID (UniqueId / sourcedoc) and combine with personal/sharepoint host domain
    const guidMatch = unescapedHtml.match(/(?:UniqueId|sourcedoc)=(?:%7B|\{)?([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:%7D|\})?/i) 
      || currentUrl.match(/(?:UniqueId|sourcedoc)=(?:%7B|\{)?([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:%7D|\})?/i);

    const hostMatch = unescapedHtml.match(/https?:\/\/[a-zA-Z0-9.-]*(?:sharepoint\.com|onedrive\.live\.com|microsoftpersonalcontent\.com)(?:\/personal\/[a-zA-Z0-9_]+)?/i)
      || currentUrl.match(/https?:\/\/[a-zA-Z0-9.-]*(?:sharepoint\.com|onedrive\.live\.com|microsoftpersonalcontent\.com)(?:\/personal\/[a-zA-Z0-9_]+)?/i);

    if (guidMatch && hostMatch) {
      const constructUrl = `${hostMatch[0]}/_layouts/15/download.aspx?UniqueId=${guidMatch[1]}`;
      try {
        console.log('[Proxy] Trying constructed GUID download URL:', constructUrl);
        const reqHeaders = { ...headers };
        if (cookies.length > 0) reqHeaders['Cookie'] = cookies.map(c => c.split(';')[0]).join('; ');
        const dlRes = await fetch(constructUrl, { headers: reqHeaders, redirect: 'follow' });
        const dlBuf = Buffer.from(await dlRes.arrayBuffer());
        if (isValidExcelBuffer(dlBuf)) {
          return dlBuf;
        }
      } catch (e) {}
    }

    // Strategy D: Fallback by adding download=1 parameter to current URL
    let fallbackDlUrl = currentUrl;
    if (fallbackDlUrl.includes('view.aspx')) {
      fallbackDlUrl = fallbackDlUrl.replace('view.aspx', 'download.aspx');
    } else if (!fallbackDlUrl.includes('download=1')) {
      const sep = fallbackDlUrl.includes('?') ? '&' : '?';
      fallbackDlUrl = `${fallbackDlUrl}${sep}download=1`;
    }

    if (fallbackDlUrl !== currentUrl) {
      try {
        console.log('[Proxy] Trying fallback download URL:', fallbackDlUrl);
        const reqHeaders = { ...headers };
        if (cookies.length > 0) reqHeaders['Cookie'] = cookies.map(c => c.split(';')[0]).join('; ');
        const dlRes = await fetch(fallbackDlUrl, { headers: reqHeaders, redirect: 'follow' });
        const dlBuf = Buffer.from(await dlRes.arrayBuffer());
        if (isValidExcelBuffer(dlBuf)) {
          return dlBuf;
        }
      } catch (e) {}
    }

    break;
  }

  throw new Error('The online link returned a web page requiring interactive login or permission. Please verify the sharing setting is "Anyone with the link can view", or copy & paste the data directly into the Paste box.');
}

// In-memory cache for synced online Excel files
const onlineFileCache = new Map<string, { buffer: Buffer, updatedAt: string, fileName: string }>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API route for fetching online Excel files (proxy to bypass CORS & handle OneDrive/Google Sheets links)
  app.post('/api/fetch-online-excel', async (req, res) => {
    try {
      const { url, refresh } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
      }

      const forceRefresh = refresh === true || req.body.force === true;

      // Check if we have a locally synced version in cache (unless refresh requested)
      if (!forceRefresh && onlineFileCache.has(url)) {
        const cached = onlineFileCache.get(url)!;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${cached.fileName || 'synced_online_log.xlsx'}"`);
        res.setHeader('X-Synced-At', cached.updatedAt);
        return res.send(cached.buffer);
      }

      const excelBuffer = await resolveAndDownloadOnlineExcel(url);

      // Cache initial fetched buffer
      onlineFileCache.set(url, {
        buffer: excelBuffer,
        updatedAt: new Date().toISOString(),
        fileName: 'online_log.xlsx'
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="online_log.xlsx"');
      return res.send(excelBuffer);

    } catch (error: any) {
      console.error('[Proxy Error]', error);
      return res.status(400).json({ error: error?.message || 'Failed to fetch online Excel file.' });
    }
  });

  // API route for syncing modified online Excel files
  app.post('/api/sync-online-excel', async (req, res) => {
    try {
      const { url, fileName, fileBufferBase64, webhookUrl } = req.body;

      if (!fileBufferBase64 || typeof fileBufferBase64 !== 'string') {
        return res.status(400).json({ error: 'fileBufferBase64 is required' });
      }

      const buffer = Buffer.from(fileBufferBase64, 'base64');
      const updatedAt = new Date().toISOString();
      const targetFileName = fileName || 'synced_online_log.xlsx';

      if (url && typeof url === 'string') {
        onlineFileCache.set(url, {
          buffer,
          updatedAt,
          fileName: targetFileName
        });
      }

      // Store under default global key as well
      onlineFileCache.set('latest_active_session', {
        buffer,
        updatedAt,
        fileName: targetFileName
      });

      let webhookResult = null;
      if (webhookUrl && typeof webhookUrl === 'string' && webhookUrl.startsWith('http')) {
        try {
          console.log(`[Sync] Triggering webhook sync to: ${webhookUrl}`);
          const whRes = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'AMH-Log-Sync/1.0'
            },
            body: JSON.stringify({
              fileName: targetFileName,
              updatedAt,
              fileBufferBase64,
              sourceUrl: url || null
            })
          });
          webhookResult = {
            status: whRes.status,
            ok: whRes.ok,
            message: whRes.ok ? 'Webhook sync successful' : `Webhook returned HTTP ${whRes.status}`
          };
        } catch (whErr: any) {
          console.error('[Sync Webhook Error]', whErr);
          webhookResult = {
            status: 500,
            ok: false,
            message: whErr?.message || 'Failed to reach webhook URL'
          };
        }
      }

      return res.json({
        success: true,
        syncedAt: updatedAt,
        message: 'Successfully synced modifications to online session cache.',
        webhookResult
      });

    } catch (error: any) {
      console.error('[Sync Error]', error);
      return res.status(500).json({ error: error?.message || 'Failed to sync online file.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
