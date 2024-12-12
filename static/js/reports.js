// Initialize charts when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Category Value Chart
    const categoryValueCtx = document.getElementById('categoryValueChart');
    if (categoryValueCtx) {
        new Chart(categoryValueCtx, {
            type: 'doughnut',
            data: categoryValueData,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });
    }

    // Initialize Stock Movement Chart
    const stockMovementCtx = document.getElementById('stockMovementChart');
    if (stockMovementCtx) {
        new Chart(stockMovementCtx, {
            type: 'line',
            data: stockMovementData,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
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
