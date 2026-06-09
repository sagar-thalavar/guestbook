/**
 * Custom Promise-based Dialog Modals matching the Guestbook design system.
 * Replaces native browser alert(), confirm(), and prompt() dialogs.
 */

export function showAlert(message: string, title: string = 'Notification'): Promise<void> {
  return new Promise((resolve) => {
    const modal = document.getElementById('custom-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalInputContainer = document.getElementById('modal-input-container');
    const btnCancel = document.getElementById('modal-btn-cancel') as HTMLElement;
    const btnOk = document.getElementById('modal-btn-ok') as HTMLElement;

    if (!modal || !modalTitle || !modalMessage || !btnCancel || !btnOk) {
      // Fallback
      alert(message);
      resolve();
      return;
    }

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    if (modalInputContainer) modalInputContainer.style.display = 'none';
    btnCancel.style.display = 'none';

    modal.style.display = 'flex';
    // Trigger CSS animation reflow
    void modal.offsetWidth;
    modal.classList.add('active');

    const handleOk = () => {
      cleanup();
      resolve();
    };

    const cleanup = () => {
      btnOk.removeEventListener('click', handleOk);
      modal.classList.remove('active');
      setTimeout(() => {
        modal.style.display = 'none';
      }, 200); // Wait for fade-out animation
    };

    btnOk.addEventListener('click', handleOk);
  });
}

export function showConfirm(message: string, title: string = 'Confirm'): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = document.getElementById('custom-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalInputContainer = document.getElementById('modal-input-container');
    const btnCancel = document.getElementById('modal-btn-cancel') as HTMLElement;
    const btnOk = document.getElementById('modal-btn-ok') as HTMLElement;

    if (!modal || !modalTitle || !modalMessage || !btnCancel || !btnOk) {
      const res = confirm(message);
      resolve(res);
      return;
    }

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    if (modalInputContainer) modalInputContainer.style.display = 'none';
    btnCancel.style.display = 'inline-flex';

    modal.style.display = 'flex';
    void modal.offsetWidth;
    modal.classList.add('active');

    const handleOk = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      btnOk.removeEventListener('click', handleOk);
      btnCancel.removeEventListener('click', handleCancel);
      modal.classList.remove('active');
      setTimeout(() => {
        modal.style.display = 'none';
      }, 200);
    };

    btnOk.addEventListener('click', handleOk);
    btnCancel.addEventListener('click', handleCancel);
  });
}

export function showPrompt(message: string, placeholder: string = '', title: string = 'Input Required'): Promise<string | null> {
  return new Promise((resolve) => {
    const modal = document.getElementById('custom-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalInputContainer = document.getElementById('modal-input-container');
    const modalInput = document.getElementById('modal-input') as HTMLInputElement;
    const btnCancel = document.getElementById('modal-btn-cancel') as HTMLElement;
    const btnOk = document.getElementById('modal-btn-ok') as HTMLElement;

    if (!modal || !modalTitle || !modalMessage || !btnCancel || !btnOk || !modalInput) {
      const res = prompt(message);
      resolve(res);
      return;
    }

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    
    if (modalInputContainer) modalInputContainer.style.display = 'block';
    modalInput.value = '';
    modalInput.placeholder = placeholder;
    btnCancel.style.display = 'inline-flex';

    modal.style.display = 'flex';
    void modal.offsetWidth;
    modal.classList.add('active');
    
    // Auto-focus input
    setTimeout(() => modalInput.focus(), 50);

    const handleOk = () => {
      const val = modalInput.value;
      cleanup();
      resolve(val);
    };

    const handleCancel = () => {
      cleanup();
      resolve(null);
    };

    const cleanup = () => {
      btnOk.removeEventListener('click', handleOk);
      btnCancel.removeEventListener('click', handleCancel);
      modal.classList.remove('active');
      setTimeout(() => {
        modal.style.display = 'none';
      }, 200);
    };

    btnOk.addEventListener('click', handleOk);
    btnCancel.addEventListener('click', handleCancel);
    
    // Support enter key on input
    modalInput.addEventListener('keydown', function onKeyDown(e) {
      if (e.key === 'Enter') {
        modalInput.removeEventListener('keydown', onKeyDown);
        handleOk();
      }
    });
  });
}
