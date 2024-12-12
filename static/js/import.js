document.addEventListener('DOMContentLoaded', function() {
    const importForm = document.getElementById('importForm');
    const importButton = document.getElementById('importButton');
    const spinner = importButton.querySelector('.spinner-border');
    const progressBar = document.getElementById('importProgress');
    
    if (importForm) {
        importForm.addEventListener('submit', function(e) {
            // Show loading states
            importButton.disabled = true;
            spinner.classList.remove('d-none');
            progressBar.classList.remove('d-none');
            
            // Allow the form to submit
            return true;
        });
    }
});
