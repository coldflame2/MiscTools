interface ContactSheetPage {
  id: string;
  folderName: string;
  specName?: string;
  images: any[];
}

function reflowSheets(sheets: ContactSheetPage[], capacity: number) {
  const newSheets: ContactSheetPage[] = [];
  
  // Group sheets by a key (folderName + specName)
  // Actually, we want to preserve order. We can just iterate through sheets.
  // Whenever the folderName or specName changes, we start a new group.
  
  let currentGroupImages: any[] = [];
  let currentFolder = '';
  let currentSpec = '';
  
  const flushGroup = () => {
    for (let i = 0; i < currentGroupImages.length; i += capacity) {
      const chunk = currentGroupImages.slice(i, i + capacity);
      newSheets.push({
        id: crypto.randomUUID(), // Assume available
        folderName: currentFolder,
        specName: currentSpec,
        images: chunk
      });
    }
  };
  
  for (const sheet of sheets) {
    if (sheet.folderName !== currentFolder || sheet.specName !== currentSpec) {
      if (currentGroupImages.length > 0) flushGroup();
      currentFolder = sheet.folderName;
      currentSpec = sheet.specName || '';
      currentGroupImages = [...sheet.images];
    } else {
      currentGroupImages.push(...sheet.images);
    }
  }
  if (currentGroupImages.length > 0) flushGroup();
  
  return newSheets;
}
