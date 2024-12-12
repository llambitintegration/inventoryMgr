// Enhanced search and lookup functionality
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.createElement('div');
    searchResults.className = 'search-results position-absolute w-100 mt-1 bg-dark rounded shadow-lg d-none';
    searchInput.parentElement.style.position = 'relative';
    searchInput.parentElement.appendChild(searchResults);
    
    let debounceTimeout;
    
    if (searchInput) {
        // Add keyboard shortcut (Ctrl+K or Cmd+K) to focus search
        document.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                searchInput.focus();
            }
        });

        searchInput.addEventListener('keyup', function(e) {
            clearTimeout(debounceTimeout);
            const searchText = this.value.trim();
            
            // Show/hide search results dropdown
            if (searchText.length > 0) {
                searchResults.classList.remove('d-none');
            } else {
                searchResults.classList.add('d-none');
                return;
            }

            // Filter table rows
            const table = document.querySelector('table');
            const rows = table.getElementsByTagName('tr');
            let resultsHtml = '';
            let resultCount = 0;

            for (let i = 1; i < rows.length && resultCount < 5; i++) {
                const row = rows[i];
                const cells = row.getElementsByTagName('td');
                let matchScore = 0;
                let highlightedText = '';

                // Calculate match score and prepare highlighted text
                for (let j = 0; j < cells.length - 1; j++) { // Exclude actions column
                    const cellText = cells[j].textContent.toLowerCase();
                    const cellContent = cells[j].textContent;
                    if (cellText.includes(searchText.toLowerCase())) {
                        matchScore += 2;
                        if (j === 0) matchScore += 3; // Boost score for part number matches
                        if (j === 1) matchScore += 2; // Boost score for description matches
                        
                        highlightedText = cellContent;
                        break;
                    }
                }

                if (matchScore > 0) {
                    resultsHtml += `
                        <div class="search-result p-2 border-bottom cursor-pointer" 
                             onclick="showComponentDetails('${cells[0].textContent}')">
                            <div class="fw-bold">${cells[0].textContent}</div>
                            <small class="text-muted">${cells[1].textContent.substring(0, 100)}...</small>
                        </div>
                    `;
                    resultCount++;
                }

                row.style.display = matchScore > 0 ? '' : 'none';
            }

            // Update search results dropdown
            if (resultCount > 0) {
                searchResults.innerHTML = resultsHtml + `
                    <div class="p-2 text-muted small">
                        <kbd>↑</kbd> <kbd>↓</kbd> to navigate &nbsp; <kbd>Enter</kbd> to select &nbsp; <kbd>Esc</kbd> to dismiss
                    </div>`;
            } else {
                searchResults.innerHTML = `
                    <div class="p-3 text-muted">
                        No matching components found
                    </div>`;
            }
        });

        // Handle keyboard navigation in search results
        searchInput.addEventListener('keydown', function(e) {
            const results = searchResults.querySelectorAll('.search-result');
            const current = searchResults.querySelector('.search-result.active');
            
            switch(e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (!current) {
                        results[0]?.classList.add('active');
                    } else {
                        const next = [...results].indexOf(current) + 1;
                        if (next < results.length) {
                            current.classList.remove('active');
                            results[next].classList.add('active');
                        }
                    }
                    break;
                    
                case 'ArrowUp':
                    e.preventDefault();
                    if (current) {
                        const prev = [...results].indexOf(current) - 1;
                        if (prev >= 0) {
                            current.classList.remove('active');
                            results[prev].classList.add('active');
                        }
                    }
                    break;
                    
                case 'Enter':
                    if (current) {
                        e.preventDefault();
                        current.click();
                    }
                    break;
                    
                case 'Escape':
                    searchResults.classList.add('d-none');
                    searchInput.blur();
                    break;
            }
        });

        // Hide search results when clicking outside
        document.addEventListener('click', function(e) {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.classList.add('d-none');
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

// Component details modal functionality
let componentModal;
let currentComponentId;

document.addEventListener('DOMContentLoaded', function() {
    componentModal = new bootstrap.Modal(document.getElementById('componentModal'));
});

async function showComponentDetails(partNumber) {
    try {
        const response = await fetch(`/api/inventory/component/${encodeURIComponent(partNumber)}`);
        const data = await response.json();
        
        if (data.error) {
            showError(data.error);
            return;
        }
        
        // Update modal content
        currentComponentId = data.component.component_id;
        document.getElementById('modalPartNumber').textContent = data.component.supplier_part_number;
        document.getElementById('modalDescription').textContent = data.component.description;
        document.getElementById('modalSupplier').textContent = data.component.supplier_name;
        document.getElementById('modalQuantity').textContent = data.component.current_quantity;
        document.getElementById('modalLocation').textContent = data.component.location_code;
        document.getElementById('modalType').textContent = data.component.owner;
        
        // Update transactions table
        const transactionsHtml = data.transactions.map(t => `
            <tr>
                <td>${new Date(t.transaction_date).toLocaleDateString()}</td>
                <td>
                    <span class="badge bg-${t.transaction_type === 'IN' ? 'success' : 
                                         t.transaction_type === 'OUT' ? 'danger' : 
                                         'warning'}">
                        ${t.transaction_type}
                    </span>
                </td>
                <td>${t.quantity}</td>
                <td>${t.notes || ''}</td>
            </tr>
        `).join('');
        
        document.getElementById('modalTransactions').innerHTML = transactionsHtml;
        
        // Show modal
        componentModal.show();
        
    } catch (error) {
        console.error('Error:', error);
        showError('Error fetching component details');
    }
}

// Add styles for search results
const style = document.createElement('style');
style.textContent = `
    .search-result {
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .search-result:hover, .search-result.active {
        background-color: var(--bs-gray-800);
    }
    .cursor-pointer {
        cursor: pointer;
    }
`;
document.head.appendChild(style);

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
