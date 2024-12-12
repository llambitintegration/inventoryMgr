// Initialize charts when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize date range picker with default values
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const updateButton = document.getElementById('updateDateRange');
    
    // Set default date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    startDateInput.value = startDate.toISOString().split('T')[0];
    endDateInput.value = endDate.toISOString().split('T')[0];
    
    // Initialize Category Value Chart
    const categoryValueCtx = document.getElementById('categoryValueChart');
    if (categoryValueCtx && typeof categoryValueData !== 'undefined') {
        new Chart(categoryValueCtx, {
            type: 'doughnut',
            data: categoryValueData,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                return `$${value.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })}`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Initialize Stock Movement Chart
    let stockMovementChart = null;
    const stockMovementCtx = document.getElementById('stockMovementChart');
    
    function initStockMovementChart(data) {
        if (stockMovementChart) {
            stockMovementChart.destroy();
        }
        
        stockMovementChart = new Chart(stockMovementCtx, {
            type: 'line',
            data: data || stockMovementData,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                return `Net Change: ${value > 0 ? '+' : ''}${value}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Net Change in Stock'
                        }
                    },
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Date'
                        },
                        ticks: {
                            maxTicksLimit: 10
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                }
            }
        });
    }

    // Initialize Feather Icons for the export buttons
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
});

// Export table data to CSV
function exportToCsv(tableType) {
    const table = document.querySelector(`.card:has(button[onclick*="${tableType}"]) table`);
    if (!table) return;

    const rows = table.querySelectorAll('tr');
    const csvContent = [];

    // Get headers
    const headers = Array.from(rows[0].querySelectorAll('th'))
    // Initialize the stock movement chart with initial data
    if (stockMovementCtx && typeof stockMovementData !== 'undefined') {
        initStockMovementChart();
    }
    
    // Handle date range updates
    if (updateButton) {
        updateButton.addEventListener('click', async function() {
            const startDate = startDateInput.value;
            const endDate = endDateInput.value;
            
            try {
                const response = await fetch(`/api/reports/stock-movement?start=${startDate}&end=${endDate}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch updated data');
                }
                
                const data = await response.json();
                initStockMovementChart(data);
            } catch (error) {
                console.error('Error updating chart:', error);
                // Show error message to user
                const alertDiv = document.createElement('div');
                alertDiv.className = 'alert alert-danger alert-dismissible fade show';
                alertDiv.innerHTML = `
                    Error updating chart: ${error.message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                `;
                document.querySelector('.card-body').prepend(alertDiv);
            }
        });
    }
});
        .map(header => `"${header.textContent.trim()}"`);
    csvContent.push(headers.join(','));

    // Get data rows
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowData = Array.from(row.querySelectorAll('td'))
            .map(cell => {
                // Get text content, removing any extra spaces
                let content = cell.textContent.trim();
                // Handle cells with badge spans
                const badge = cell.querySelector('.badge');
                if (badge) {
                    content = badge.textContent.trim();
                }
                return `"${content}"`;
            });
        csvContent.push(rowData.join(','));
    }

    // Create and trigger download
    const blob = new Blob([csvContent.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${tableType}-report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
