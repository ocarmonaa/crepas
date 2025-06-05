/**
 * Genera un PDF con el reporte de ventas
 */
async function generarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Configuración inicial del documento
    doc.setProperties({
        title: 'Reporte de Ventas de Crepas',
        subject: 'Ventas',
        author: 'Sistema de Control de Crepas',
        keywords: 'crepas, ventas, reporte',
        creator: 'Sistema de Control de Crepas'
    });
    
    // Título
    doc.setFontSize(20);
    doc.setTextColor(75, 75, 75);
    doc.text('Reporte de Ventas de Crepas', 105, 20, { align: 'center' });
    
    // Logo
    try {
        const logo = await loadImage('img/crepas-logo.png');
        doc.addImage(logo, 'PNG', 10, 10, 30, 30);
    } catch (error) {
        console.error("Error al cargar el logo:", error);
    }
    
    // Fecha de generación
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generado el: ${new Date().toLocaleDateString('es-MX', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })}`, 10, 40);
    
    // Precio por bolsa
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Precio por bolsa: $${PRECIO_BOLSA.toFixed(2)} MXN`, 10, 50);
    
    // Tabla de ventas
    const headers = [['Nombre', 'Bolsas', 'Total', 'Pagado', 'Restante', 'Fecha']];
    
    const data = ventas.map(venta => {
        const fecha = new Date(venta.fecha);
        return [
            venta.nombre,
            venta.bolsas,
            `$${venta.total.toFixed(2)}`,
            `$${venta.montoPagado.toFixed(2)}`,
            `$${venta.restante.toFixed(2)}`,
            fecha.toLocaleDateString('es-MX')
        ];
    });
    
    doc.autoTable({
        head: headers,
        body: data,
        startY: 60,
        theme: 'grid',
        headStyles: {
            fillColor: [152, 251, 152], // Verde pastel
            textColor: [75, 75, 75],
            fontStyle: 'bold'
        },
        alternateRowStyles: {
            fillColor: [255, 255, 255]
        },
        styles: {
            cellPadding: 5,
            fontSize: 10,
            valign: 'middle'
        },
        columnStyles: {
            0: { cellWidth: 'auto', fontStyle: 'bold' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 'auto' },
            4: { cellWidth: 'auto', 
                 textColor: function(row) {
                     return row.data[4].includes('$0.00') ? [56, 142, 60] : [211, 47, 47];
                 } 
            },
            5: { cellWidth: 'auto' }
        },
        margin: { top: 60 }
    });
    
    // Totalizadores
    const totalVentas = ventas.reduce((sum, venta) => sum + venta.total, 0);
    const totalPagado = ventas.reduce((sum, venta) => sum + venta.montoPagado, 0);
    const totalRestante = ventas.reduce((sum, venta) => sum + venta.restante, 0);
    
    const finalY = doc.lastAutoTable.finalY + 15;
    
    doc.setFontSize(12);
    doc.setTextColor(75, 75, 75);
    doc.text(`Total de ventas: $${totalVentas.toFixed(2)}`, 14, finalY);
    doc.text(`Total pagado: $${totalPagado.toFixed(2)}`, 14, finalY + 10);
    doc.text(`Total pendiente: $${totalRestante.toFixed(2)}`, 14, finalY + 20);
    
    // Pie de página
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Sistema de Control de Ventas de Crepas © 2023', 105, 285, { align: 'center' });
    
    // Guardar el PDF
    doc.save(`reporte_ventas_crepas_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * Carga una imagen para incluir en el PDF
 * @param {string} url - URL de la imagen
 * @returns {Promise} Promesa que resuelve con la imagen cargada
 */
function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = reject;
    });
}