document.addEventListener('DOMContentLoaded', function() {
    const importForm = document.getElementById('importForm');
    const importButton = document.getElementById('importButton');
    const spinner = importButton.querySelector('.spinner-border');
    const progressBar = document.getElementById('importProgress');
    const progressBarInner = progressBar.querySelector('.progress-bar');
    let statusCheckInterval;
    
    function updateProgress(status) {
        const percent = (status.current_row / status.total_rows * 100) || 0;
        progressBarInner.style.width = `${percent}%`;
        progressBarInner.textContent = status.message;
        
        if (status.status === 'completed' || status.status === 'error') {
            clearInterval(statusCheckInterval);
            importButton.disabled = false;
            spinner.classList.add('d-none');
            
            if (status.status === 'completed') {
                progressBarInner.classList.remove('progress-bar-animated');
                progressBarInner.classList.add('bg-success');
            } else {
                progressBarInner.classList.remove('progress-bar-animated');
                progressBarInner.classList.add('bg-danger');
            }
            
            // Hide progress bar after showing final status
            setTimeout(() => {
                progressBar.classList.add('d-none');
                progressBarInner.classList.remove('bg-success', 'bg-danger');
                progressBarInner.classList.add('progress-bar-animated');
                window.location.href = '/inventory';  // Redirect to inventory page after completion
            }, 3000);
        }
    }
    
    function checkImportStatus() {
        fetch('/api/import/status')
            .then(response => response.json())
            .then(status => updateProgress(status))
            .catch(error => {
                console.error('Error checking import status:', error);
                clearInterval(statusCheckInterval);
            });
    }
    
    if (importForm) {
        importForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Show loading states
            importButton.disabled = true;
            spinner.classList.remove('d-none');
            progressBar.classList.remove('d-none');
            
            // Submit form via AJAX
            const formData = new FormData(importForm);
            fetch('/import', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }
                // Start checking status
                statusCheckInterval = setInterval(checkImportStatus, 1000);
            })
            .catch(error => {
                console.error('Error:', error);
                progressBarInner.textContent = `Error: ${error.message}`;
                progressBarInner.classList.remove('progress-bar-animated');
                progressBarInner.classList.add('bg-danger');
                importButton.disabled = false;
                spinner.classList.add('d-none');
            });
        });
    }
});
