// Enhanced search and lookup functionality
function updateSearchResults(data) {
    console.log('Updating search results with:', data);
    const searchResults = document.querySelector('.search-results');
    
    if (!searchResults) {
        console.error('Search results container not found');
        return;
    }

    if (!Array.isArray(data)) {
        console.error('Unexpected data format:', data);
        searchResults.innerHTML = `
            <div class="p-3 text-danger">
                Error: Invalid search results format
            </div>`;
        return;
    }

    if (data.length === 0) {
        searchResults.innerHTML = `
            <div class="p-3 text-muted">
                No matching items found
            </div>`;
        return;
    }

    let resultsHtml = '';
    for (const item of data) {
        resultsHtml += `
            <div class="search-result p-2 border-bottom" onclick="showComponentDetails('${item.part_number}')">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <div class="fw-bold">${item.part_number}</div>
                        <div class="small text-muted">${item.description}</div>
                    </div>
                    <span class="badge bg-secondary">${item.supplier}</span>
                </div>
                <div class="small mt-1">
                    <span class="badge bg-${item.quantity <= 0 ? 'danger' : 'success'}">
                        Qty: ${item.quantity}
                    </span>
                    <span class="badge bg-info ms-2">${item.location}</span>
                </div>
            </div>`;
    }
    searchResults.innerHTML = resultsHtml;
    searchResults.classList.remove('d-none');
}

async function performSearch(searchText) {
    console.log('Performing search for:', searchText);
    const searchResults = document.querySelector('.search-results');
    
    if (!searchResults) {
        console.error('Search results container not found');
        return;
    }

    // Show loading state
    searchResults.innerHTML = `
        <div class="p-3 text-muted">
            <div class="spinner-border spinner-border-sm me-2" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            Searching...
        </div>`;
    searchResults.classList.remove('d-none');

    try {
        const response = await fetch(`/api/inventory/search?q=${encodeURIComponent(searchText)}`);
        console.log('Search response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Search response data:', data);
        updateSearchResults(data);
    } catch (error) {
        console.error('Search error:', error);
        searchResults.innerHTML = `
            <div class="p-3 text-danger">
                Error performing search: ${error.message}
            </div>`;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing search functionality');
    const searchInput = document.getElementById('searchInput');
    const searchForm = document.getElementById('searchForm');
    
    // Create search results container
    const searchResults = document.createElement('div');
    searchResults.className = 'search-results position-absolute w-100 mt-1 bg-dark rounded shadow-lg d-none';
    searchInput.parentElement.style.position = 'relative';
    searchInput.parentElement.appendChild(searchResults);
    
    let debounceTimeout;
    
    if (searchInput && searchForm) {
        console.log('Search elements initialized:', { 
            searchInput: !!searchInput, 
            searchForm: !!searchForm 
        });

        // Handle form submission
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('Search form submitted');
            const searchText = searchInput.value.trim();
            if (searchText) {
                performSearch(searchText);
            }
        });

        // Add keyboard shortcut (/) to focus search
        document.addEventListener('keydown', function(e) {
            if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                searchInput.focus();
            }
        });

        // Handle input changes
        searchInput.addEventListener('keyup', function(e) {
            console.log('Keyup event on search input:', e.key);
            if (e.key === 'Enter') {
                console.log('Enter key pressed, performing search');
                performSearch(e.target.value);
                return;
            }
            clearTimeout(debounceTimeout);
            const searchText = this.value.trim();
            
            // Show/hide search results dropdown
            if (searchText.length > 0) {
                searchResults.classList.remove('d-none');
            } else {
                searchResults.classList.add('d-none');
                return;
            }

            // Show loading state
            searchResults.innerHTML = `
                <div class="p-3 text-muted">
                    <div class="spinner-border spinner-border-sm me-2" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    Searching...
                </div>
            `;
            
            // Fetch search results from server
            debounceTimeout = setTimeout(async () => {
                try {
                    console.log('Initiating search for:', searchText);
                    const url = `/api/inventory/search?q=${encodeURIComponent(searchText)}`;
                    console.log('Search URL:', url);
                    
                    const response = await fetch(url);
                    console.log('Response status:', response.status);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    console.log('Search response data:', data);
                    
                    if (!Array.isArray(data)) {
                        console.error('Unexpected response format:', data);
                        throw new Error('Invalid response format');
                    }
                    
                    if (data.error) {
                        console.error('Search error:', data.error);
                        searchResults.innerHTML = `
                            <div class="p-3 text-danger">
                                <i data-feather="alert-circle"></i> ${data.error}
                            </div>`;
                        feather.replace();
                        return;
                    }

                    let resultsHtml = '';
                    for (const item of data) {
                        resultsHtml += `
                            <div class="search-result p-2 border-bottom cursor-pointer" 
                                 onclick="showComponentDetails('${item.part_number}')">
                                <div class="d-flex justify-content-between align-items-start">
                                    <div>
                                        <div class="fw-bold">
                                            <i data-feather="box"></i> ${item.part_number}
                                        </div>
                                        <div class="small text-muted">${item.description}</div>
                                    </div>
                                    <span class="badge bg-secondary">${item.supplier}</span>
                                </div>
                                <div class="small mt-1">
                                    <span class="badge bg-${item.quantity <= 0 ? 'danger' : 'success'}">
                                        Qty: ${item.quantity}
                                    </span>
                                    <span class="badge bg-info ms-2">${item.location}</span>
                                    <span class="badge bg-secondary ms-2">${item.type}</span>
                                </div>
                            </div>
                        `;
                    }

                    // Update search results dropdown
                    if (data.length > 0) {
                        searchResults.innerHTML = resultsHtml + `
                            <div class="p-2 text-muted small">
                                <kbd>↑</kbd> <kbd>↓</kbd> to navigate &nbsp; <kbd>Enter</kbd> to select &nbsp; <kbd>Esc</kbd> to dismiss
                            </div>`;
                        // Initialize Feather icons for new content
                        feather.replace();
                    } else {
                        searchResults.innerHTML = `
                            <div class="p-3 text-muted">
                                No matching components found
                            </div>`;
                    }
                } catch (error) {
                    console.error('Error fetching search results:', error);
                    searchResults.innerHTML = `
                        <div class="p-3 text-danger">
                            Error performing search
                        </div>`;
                }
            }, 300); // Debounce delay

            // Search results are updated in the try-catch block above
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
// Global variables for modal handling
let quantityModal, componentModal;
let currentComponentId = null;

document.addEventListener('DOMContentLoaded', function() {
    quantityModal = new bootstrap.Modal(document.getElementById('quantityModal'));
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
