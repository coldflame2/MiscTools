import React from 'react';

interface EditableLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditableLogModal: React.FC<EditableLogModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-40 flex items-center justify-center animate-fade-in-fast"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      <div className="bg-white rounded-xl shadow-2xl p-8 text-center max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 className="text-xl font-bold text-slate-800">Feature Coming Soon</h2>
        </header>
        <main className="mt-4">
          <p className="text-slate-600">
            The ability to edit the original log directly within the app is currently under development. Please check back later!
          </p>
        </main>
        <footer className="mt-6">
           <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close"
          >
            Got it
          </button>
        </footer>
      </div>
    </div>
  );
};
