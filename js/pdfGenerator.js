/**
 * Genera un PDF con el reporte de ventas
 */
async function generarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    // Configuración inicial del documento
    doc.setProperties({
        title: 'Reporte de Ventas de Crepas',
        subject: 'Ventas',
        author: 'Sistema de Control de Crepas',
        keywords: 'crepas, ventas, reporte',
        creator: 'Sistema de Control de Crepas'
    });

    // Margenes y posiciones
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;
    let currentY = margin;

    // Logo
    try {
        const logoData = await getBase64Image('img/crepas-logo.png');
        doc.addImage(logoData, 'PNG', centerX - 15, currentY, 30, 30);
        currentY += 32; // Espacio después del logo
    } catch (error) {
        console.error("Error al cargar el logo:", error);
    }

    // Título
    doc.setFontSize(20);
    doc.setTextColor(75, 75, 75);
    doc.text('Reporte de Ventas de Crepas', centerX, currentY, { align: 'center' });
    currentY += 10;

    // Fecha de generación
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generado el: ${new Date().toLocaleDateString('es-MX', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })}`, centerX, currentY, { align: 'center' });
    currentY += 8;

    // Precio por bolsa
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Precio por bolsa: $${PRECIO_BOLSA.toFixed(2)} MXN`, centerX, currentY, { align: 'center' });
    currentY += 10;

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
        startY: currentY,
        theme: 'grid',
        headStyles: {
            fillColor: [152, 251, 152], // Verde pastel
            textColor: [75, 75, 75],
            fontStyle: 'bold',
            cellPadding: 3
        },
        bodyStyles: {
            cellPadding: 3
        },
        alternateRowStyles: {
            fillColor: [240, 248, 255] // Azul pastel claro
        },
        styles: {
            fontSize: 9,
            valign: 'middle',
            halign: 'center',
            cellPadding: 2
        },
        columnStyles: {
            0: { 
                cellWidth: 'auto', 
                halign: 'left',
                fillColor: [255, 182, 193] // Rosa pastel para nombres
            },
            1: { 
                cellWidth: 'auto',
                fillColor: [255, 255, 255] // Blanco para números
            },
            2: { 
                cellWidth: 'auto',
                fillColor: [255, 255, 255]
            },
            3: { 
                cellWidth: 'auto',
                fillColor: [255, 255, 255]
            },
            4: { 
                cellWidth: 'auto',
                textColor: function(row) {
                    return row.data[4].includes('$0.00') ? [56, 142, 60] : [211, 47, 47];
                },
                fillColor: [255, 255, 255]
            },
            5: { 
                cellWidth: 'auto',
                fillColor: [173, 216, 230] // Azul pastel para fechas
            }
        },
        margin: { 
            top: currentY,
            left: margin,
            right: margin
        },
        tableWidth: 'auto'
    });

    // Totalizadores
    const totalVentas = ventas.reduce((sum, venta) => sum + venta.total, 0);
    const totalPagado = ventas.reduce((sum, venta) => sum + venta.montoPagado, 0);
    const totalRestante = ventas.reduce((sum, venta) => sum + venta.restante, 0);
    
    const finalY = doc.lastAutoTable.finalY + 10;
    
    doc.setFontSize(12);
    doc.setTextColor(75, 75, 75);
    doc.text(`Total de ventas: $${totalVentas.toFixed(2)}`, margin, finalY);
    doc.text(`Total pagado: $${totalPagado.toFixed(2)}`, margin, finalY + 8);
    doc.text(`Total pendiente: $${totalRestante.toFixed(2)}`, margin, finalY + 16);

    // Pie de página
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Sistema de Control de Ventas de Crepas © 2023', centerX, 285, { align: 'center' });

    // Guardar el PDF
    doc.save(`reporte_ventas_crepas_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * Convierte una imagen a Base64 para incluir en el PDF
 * @param {string} url - URL de la imagen
 * @returns {Promise} Promesa que resuelve con la imagen en Base64
 */
function getBase64Image(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = url;
        
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            const dataURL = canvas.toDataURL('image/png');
            resolve(dataURL);
        };
        
        img.onerror = function() {
            reject(new Error('Error al cargar la imagen'));
        };
    });
}