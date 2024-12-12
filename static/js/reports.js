document.addEventListener('DOMContentLoaded', function() {
    // Initialize charts
    const categoryValueCtx = document.getElementById('categoryValueChart')?.getContext('2d');
    const stockMovementCtx = document.getElementById('stockMovementChart')?.getContext('2d');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const updateButton = document.getElementById('updateDateRange');

    let stockMovementChart = null;
    
    // Initialize category value chart
    if (categoryValueCtx && typeof categoryValueData !== 'undefined') {
        console.log('Category Value Data:', categoryValueData);
        new Chart(categoryValueCtx, {
            type: 'pie',
            data: {
                labels: categoryValueData.labels,
                datasets: [{
                    data: categoryValueData.datasets[0].data,
                    backgroundColor: categoryValueData.datasets[0].backgroundColor
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                const value = context.raw;
                                label += new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD'
                                }).format(value);
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }

    // Initialize stock movement chart
    function initStockMovementChart(data = stockMovementData) {
        if (!stockMovementCtx) return;

        if (stockMovementChart) {
            stockMovementChart.destroy();
        }

        stockMovementChart = new Chart(stockMovementCtx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: data.datasets
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Net Stock Change'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    }
                }
            }
        });
    }

    // Initialize stock movement chart with initial data
    if (stockMovementCtx && typeof stockMovementData !== 'undefined') {
        initStockMovementChart();
    }

    // Set default date range (last 30 days)
    if (startDateInput && endDateInput) {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);

        startDateInput.value = start.toISOString().split('T')[0];
        endDateInput.value = end.toISOString().split('T')[0];
    }

    // Handle date range updates
    if (updateButton) {
        updateButton.addEventListener('click', async function() {
            const startDate = startDateInput.value;
            const endDate = endDateInput.value;

            if (!startDate || !endDate) {
                showAlert('Please select both start and end dates', 'warning');
                return;
            }

            try {
                const response = await fetch(`/api/reports/stock-movement?start=${startDate}&end=${endDate}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch updated data');
                }

                const data = await response.json();
                if (data.error) {
                    throw new Error(data.error);
                }

                initStockMovementChart(data);
                showAlert('Chart updated successfully', 'success');
            } catch (error) {
                console.error('Error updating chart:', error);
                showAlert('Error updating chart: ' + error.message, 'danger');
            }
        });
    }
});

// Helper function to show alerts
function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    alertDiv.style.zIndex = 1050;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 3000);
}

// Export functionality
function exportChartData(chartType) {
    if (chartType === 'category') {
        const data = categoryValueData;
        const csvContent = ['Category,Value\n'];
        
        for (let i = 0; i < data.labels.length; i++) {
            csvContent.push(`"${data.labels[i]}","${data.datasets[0].data[i]}"\n`);
        }
        
        downloadCSV(csvContent.join(''), 'inventory-by-category.csv');
    } else if (chartType === 'movement') {
        const data = stockMovementChart.data;
        const csvContent = ['Date,Net Change\n'];
        
        for (let i = 0; i < data.labels.length; i++) {
            csvContent.push(`"${data.labels[i]}","${data.datasets[0].data[i]}"\n`);
        }
        
        downloadCSV(csvContent.join(''), 'stock-movement.csv');
    }
}

function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportToCsv(tableType) {
    const table = document.querySelector(`.card:has(button[onclick="exportToCsv('${tableType}')"]) table`);
    if (!table) {
        showAlert('Table not found', 'error');
        return;
    }

    const rows = table.querySelectorAll('tr');
    const csvContent = [];

    // Get headers
    const headers = Array.from(rows[0].querySelectorAll('th'))
        .map(header => `"${header.textContent.trim()}"`);
    csvContent.push(headers.join(','));

    // Get data rows
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowData = Array.from(row.querySelectorAll('td'))
            .map(cell => {
                let content = cell.textContent.trim();
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
