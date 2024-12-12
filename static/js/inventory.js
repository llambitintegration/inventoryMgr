// Search functionality
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    
    if (searchInput) {
        searchInput.addEventListener('keyup', function() {
            const searchText = this.value.toLowerCase();
            const table = document.querySelector('table');
            const rows = table.getElementsByTagName('tr');

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const cells = row.getElementsByTagName('td');
                let found = false;

                for (let cell of cells) {
                    if (cell.textContent.toLowerCase().indexOf(searchText) > -1) {
                        found = true;
                        break;
                    }
                }

                row.style.display = found ? '' : 'none';
            }
        });
    }
});

// Quantity adjustment modal handling
let quantityModal;
let currentComponentId;

document.addEventListener('DOMContentLoaded', function() {
    quantityModal = new bootstrap.Modal(document.getElementById('quantityModal'));
});

function adjustQuantity(componentId) {
    currentComponentId = componentId;
    
    // Reset form
    document.getElementById('componentId').value = componentId;
    document.getElementById('quantity').value = '';
    document.getElementById('notes').value = '';
    document.getElementById('transactionType').value = 'IN';
    
    quantityModal.show();
}

async function saveQuantity() {
    const quantity = document.getElementById('quantity').value;
    const type = document.getElementById('transactionType').value;
    const notes = document.getElementById('notes').value;

    if (!quantity || isNaN(quantity)) {
        showError('Please enter a valid quantity');
        return;
    }

    try {
        const response = await fetch('/api/inventory/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                component_id: currentComponentId,
                quantity: parseInt(quantity),
                type: type,
                notes: notes,
                user_id: 'system' // In a real app, this would be the logged-in user
            })
        });

        const data = await response.json();

        if (data.success) {
            // Close modal
            quantityModal.hide();
            
            // Show success message
            showAlert('Inventory updated successfully', 'success');
            
            // Reload page to show updated quantities
            setTimeout(() => window.location.reload(), 1000);
        } else {
            showError(data.error || 'Error updating inventory');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Error updating inventory');
    }
}

// Helper functions for displaying alerts
function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    alertDiv.style.zIndex = 1050;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    
    // Remove alert after 3 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

function showError(message) {
    showAlert(message, 'danger');
}

// Table sorting functionality
document.addEventListener('DOMContentLoaded', function() {
    const table = document.querySelector('table');
    const headers = table.querySelectorAll('th');
    const tableBody = table.querySelector('tbody');
    const rows = tableBody.querySelectorAll('tr');

    const directions = Array.from(headers).map(() => '');

    const transform = (type, content) => {
        switch(type) {
            case 'number':
                return parseFloat(content);
            case 'string':
            default:
                return content;
        }
    };

    const sortColumn = (index) => {
        const type = index === 5 ? 'number' : 'string'; // Column 5 is quantity
        const direction = directions[index] || 'asc';
        const multiplier = direction === 'asc' ? 1 : -1;
        const newRows = Array.from(rows);

        newRows.sort((rowA, rowB) => {
            const cellA = rowA.querySelectorAll('td')[index].textContent;
            const cellB = rowB.querySelectorAll('td')[index].textContent;

            const a = transform(type, cellA);
            const b = transform(type, cellB);

            if (a > b) return 1 * multiplier;
            if (a < b) return -1 * multiplier;
            return 0;
        });

        directions[index] = direction === 'asc' ? 'desc' : 'asc';

        // Remove old rows
        while (tableBody.firstChild) {
            tableBody.removeChild(tableBody.firstChild);
        }

        // Add new rows
        tableBody.append(...newRows);
    };

    headers.forEach((header, index) => {
        header.addEventListener('click', () => {
            sortColumn(index);
        });
    });
});

// Quantity validation
document.addEventListener('DOMContentLoaded', function() {
    const quantityInput = document.getElementById('quantity');
    const transactionType = document.getElementById('transactionType');
    
    if (quantityInput && transactionType) {
        quantityInput.addEventListener('input', function() {
            const value = parseInt(this.value);
            
            if (isNaN(value) || value < 0) {
                this.setCustomValidity('Please enter a valid positive number');
            } else {
                this.setCustomValidity('');
            }
        });
    }
});
