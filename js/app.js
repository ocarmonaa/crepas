/**
 * Aplicación de Control de Ventas de Crepas
 * 
 * Esta aplicación permite:
 * - Registrar ventas de bolsas de crepas
 * - Llevar un control de pagos y saldos pendientes
 * - Filtrar y visualizar ventas
 * - Generar reportes en PDF
 * 
 * Utiliza Back4App como backend para almacenamiento de datos
 */

// Configuración de Back4App
Parse.initialize("Q7mqUi5d3hYple1dlpp8mqhFuD1Wa66IM5Vw5r0I", "O5Lr8077OH6wSw0RY2SIECRNmYstN6X1onNtrZTo");
Parse.serverURL = "https://parseapi.back4app.com/";

// Modelo de datos para las ventas
const Venta = Parse.Object.extend("Venta");

// Precio por bolsa (constante)
const PRECIO_BOLSA = 90;

// Variables globales
let ventas = []; // Almacena todas las ventas cargadas
let ventaEditando = null; // Almacena la venta que se está editando

// DOM Ready - Se ejecuta cuando el documento HTML está completamente cargado
document.addEventListener('DOMContentLoaded', function() {
    // Establecer fecha actual por defecto
    const fechaInput = document.getElementById('fecha');
    const hoy = new Date();
    const fechaLocal = new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    fechaInput.value = fechaLocal;
    
    // Cargar ventas al iniciar
    cargarVentas();
    
    // Event listeners para el formulario principal
    document.getElementById('ventaForm').addEventListener('submit', guardarVenta);
    document.getElementById('bolsas').addEventListener('input', actualizarResumen);
    document.getElementById('montoPagado').addEventListener('input', actualizarResumen);
    
    // Event listeners para botones
    document.getElementById('btnImprimir').addEventListener('click', generarPDF);
    document.getElementById('btnFiltrar').addEventListener('click', filtrarPorFecha);
    document.getElementById('btnLimpiarFiltro').addEventListener('click', cargarVentas);
    
    // Event listeners para el modal de edición
    document.querySelector('.close-modal').addEventListener('click', cerrarModal);
    document.querySelector('.cancelar-edicion').addEventListener('click', cerrarModal);
    document.getElementById('editarForm').addEventListener('submit', actualizarVenta);
    
    // Event listener para cerrar modal al hacer clic fuera del contenido
    window.addEventListener('click', function(event) {
        if (event.target === document.getElementById('modalEditar')) {
            cerrarModal();
        }
    });
});

/**
 * Calcula el total de una venta basado en la cantidad de bolsas
 * @param {number} bolsas - Cantidad de bolsas vendidas
 * @returns {number} Total a pagar
 */
function calcularTotal(bolsas) {
    return bolsas * PRECIO_BOLSA;
}

/**
 * Calcula el saldo restante de una venta
 * @param {number} total - Total a pagar
 * @param {number} pagado - Monto pagado
 * @returns {number} Saldo restante
 */
function calcularRestante(total, pagado) {
    return Math.max(total - pagado, 0);
}

/**
 * Actualiza el resumen de la venta en tiempo real
 */
function actualizarResumen() {
    const bolsas = parseInt(document.getElementById('bolsas').value) || 0;
    const montoPagado = parseFloat(document.getElementById('montoPagado').value) || 0;
    
    const total = calcularTotal(bolsas);
    const restante = calcularRestante(total, montoPagado);
    
    const resumenHTML = `
        <p><strong>Cliente:</strong> ${document.getElementById('nombre').value || 'No especificado'}</p>
        <p><strong>Bolsas:</strong> ${bolsas}</p>
        <p><strong>Total a pagar:</strong> $${total.toFixed(2)}</p>
        <p><strong>Monto pagado:</strong> $${montoPagado.toFixed(2)}</p>
        <p class="${restante > 0 ? 'pendiente' : 'completo'}">
            <strong>Restante:</strong> $${restante.toFixed(2)}
        </p>
    `;
    
    document.getElementById('resumenVenta').innerHTML = resumenHTML;
}

/**
 * Guarda una nueva venta en la base de datos
 * @param {Event} e - Evento del formulario
 */
async function guardarVenta(e) {
    e.preventDefault();
    
    const nombre = document.getElementById('nombre').value.trim();
    const bolsas = parseInt(document.getElementById('bolsas').value);
    const fechaInput = document.getElementById('fecha').value;
    const montoPagado = parseFloat(document.getElementById('montoPagado').value) || 0;
    const comentarios = document.getElementById('comentarios').value.trim();
    
    // Validación básica
    if (!nombre || isNaN(bolsas) || bolsas < 1) {
        mostrarAlerta("Por favor complete todos los campos requeridos correctamente", "warning");
        return;
    }
    
    // Ajuste de fecha para evitar problemas de zona horaria
    const fecha = new Date(fechaInput);
    fecha.setMinutes(fecha.getMinutes() + fecha.getTimezoneOffset());
    
    const total = calcularTotal(bolsas);
    const restante = calcularRestante(total, montoPagado);
    
    const venta = new Venta();
    
    try {
        venta.set("nombre", nombre);
        venta.set("bolsas", bolsas);
        venta.set("fecha", fecha);
        venta.set("montoPagado", montoPagado);
        venta.set("total", total);
        venta.set("restante", restante);
        venta.set("comentarios", comentarios);
        
        const resultado = await venta.save();
        mostrarAlerta("Venta guardada correctamente", "success");
        document.getElementById('ventaForm').reset();
        document.getElementById('resumenVenta').innerHTML = "<p>Complete el formulario para ver el resumen</p>";
        await cargarVentas();
    } catch (error) {
        console.error("Error al guardar la venta:", error);
        mostrarAlerta(`Error al guardar la venta: ${error.message}`, "error");
    }
}

/**
 * Carga todas las ventas desde la base de datos
 */
async function cargarVentas() {
    try {
        mostrarAlerta("Cargando ventas...", "warning");
        
        const query = new Parse.Query(Venta);
        query.descending("createdAt");
        const results = await query.find();
        
        ventas = results.map(venta => ({
            id: venta.id,
            nombre: venta.get("nombre") || '',
            bolsas: venta.get("bolsas") || 0,
            total: venta.get("total") || 0,
            montoPagado: venta.get("montoPagado") || 0,
            restante: venta.get("restante") || 0,
            fecha: venta.get("fecha") ? new Date(venta.get("fecha")) : new Date(),
            comentarios: venta.get("comentarios") || '',
            createdAt: venta.createdAt
        }));
        
        mostrarVentas(ventas);
    } catch (error) {
        console.error("Error al cargar ventas:", error);
        mostrarAlerta(`Error al cargar las ventas: ${error.message}`, "error");
    }
}

/**
 * Filtra las ventas por fecha seleccionada
 */
function filtrarPorFecha() {
    const fechaFiltro = document.getElementById('filtroFecha').value;
    
    if (!fechaFiltro) {
        mostrarAlerta("Selecciona una fecha para filtrar", "warning");
        return;
    }
    
    const fechaSeleccionada = new Date(fechaFiltro);
    const ventasFiltradas = ventas.filter(venta => {
        const ventaFecha = new Date(venta.fecha);
        return ventaFecha.toDateString() === fechaSeleccionada.toDateString();
    });
    
    mostrarVentas(ventasFiltradas);
}

/**
 * Muestra las ventas en la tabla
 * @param {Array} ventasMostrar - Array de ventas a mostrar
 */
function mostrarVentas(ventasMostrar) {
    const tbody = document.getElementById('ventasBody');
    tbody.innerHTML = '';
    
    if (ventasMostrar.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No hay ventas registradas</td></tr>';
        return;
    }
    
    ventasMostrar.forEach(venta => {
        const fecha = new Date(venta.fecha);
        const fechaFormateada = fecha.toLocaleDateString('es-MX');
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${venta.nombre}</td>
            <td>${venta.bolsas}</td>
            <td>$${venta.total.toFixed(2)}</td>
            <td>$${venta.montoPagado.toFixed(2)}</td>
            <td class="${venta.restante > 0 ? 'pendiente' : 'completo'}">$${venta.restante.toFixed(2)}</td>
            <td>${fechaFormateada}</td>
            <td class="acciones-cell">
                <button class="btn btn-secondary btn-sm" onclick="abrirModalEdicion('${venta.id}')">Editar</button>
                <button class="btn btn-tertiary btn-sm" onclick="eliminarVenta('${venta.id}')">Eliminar</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

/**
 * Abre el modal de edición con los datos de la venta seleccionada
 * @param {string} id - ID de la venta a editar
 */
async function abrirModalEdicion(id) {
    try {
        const query = new Parse.Query(Venta);
        const venta = await query.get(id);
        
        // Guardar la venta que se está editando
        ventaEditando = venta;
        
        // Llenar el formulario de edición con los datos de la venta
        document.getElementById('editarId').value = venta.id;
        document.getElementById('editarNombre').value = venta.get("nombre") || '';
        document.getElementById('editarBolsas').value = venta.get("bolsas") || 0;
        
        // Ajuste de fecha para el input date
        const fecha = new Date(venta.get("fecha"));
        const fechaLocal = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        document.getElementById('editarFecha').value = fechaLocal;
        
        document.getElementById('editarMontoPagado').value = venta.get("montoPagado") || 0;
        document.getElementById('editarComentarios').value = venta.get("comentarios") || '';
        
        // Mostrar el modal
        document.getElementById('modalEditar').style.display = 'block';
    } catch (error) {
        console.error("Error al cargar venta para editar:", error);
        mostrarAlerta(`Error al cargar la venta para editar: ${error.message}`, "error");
    }
}

/**
 * Actualiza una venta existente en la base de datos
 * @param {Event} e - Evento del formulario
 */
async function actualizarVenta(e) {
    e.preventDefault();
    
    if (!ventaEditando) return;
    
    const nombre = document.getElementById('editarNombre').value.trim();
    const bolsas = parseInt(document.getElementById('editarBolsas').value);
    const fechaInput = document.getElementById('editarFecha').value;
    const montoPagado = parseFloat(document.getElementById('editarMontoPagado').value) || 0;
    const comentarios = document.getElementById('editarComentarios').value.trim();
    
    // Validación básica
    if (!nombre || isNaN(bolsas) || bolsas < 1) {
        mostrarAlerta("Por favor complete todos los campos requeridos correctamente", "warning");
        return;
    }
    
    // Ajuste de fecha para evitar problemas de zona horaria
    const fecha = new Date(fechaInput);
    fecha.setMinutes(fecha.getMinutes() + fecha.getTimezoneOffset());
    
    const total = calcularTotal(bolsas);
    const restante = calcularRestante(total, montoPagado);
    
    try {
        ventaEditando.set("nombre", nombre);
        ventaEditando.set("bolsas", bolsas);
        ventaEditando.set("fecha", fecha);
        ventaEditando.set("montoPagado", montoPagado);
        ventaEditando.set("total", total);
        ventaEditando.set("restante", restante);
        ventaEditando.set("comentarios", comentarios);
        
        await ventaEditando.save();
        mostrarAlerta("Venta actualizada correctamente", "success");
        cerrarModal();
        await cargarVentas();
    } catch (error) {
        console.error("Error al actualizar la venta:", error);
        mostrarAlerta(`Error al actualizar la venta: ${error.message}`, "error");
    }
}

/**
 * Cierra el modal de edición
 */
function cerrarModal() {
    document.getElementById('modalEditar').style.display = 'none';
    ventaEditando = null;
    document.getElementById('editarForm').reset();
}

/**
 * Elimina una venta de la base de datos
 * @param {string} id - ID de la venta a eliminar
 */
async function eliminarVenta(id) {
    if (!confirm("¿Estás seguro de que quieres eliminar esta venta?")) {
        return;
    }
    
    try {
        const query = new Parse.Query(Venta);
        const venta = await query.get(id);
        await venta.destroy();
        
        mostrarAlerta("Venta eliminada correctamente", "success");
        await cargarVentas();
    } catch (error) {
        console.error("Error al eliminar la venta:", error);
        mostrarAlerta(`Error al eliminar la venta: ${error.message}`, "error");
    }
}

/**
 * Muestra una alerta temporal en la pantalla
 * @param {string} mensaje - Mensaje a mostrar
 * @param {string} tipo - Tipo de alerta (success, error, warning)
 */
function mostrarAlerta(mensaje, tipo) {
    // Eliminar alertas existentes
    const alertasExistentes = document.querySelectorAll('.alerta');
    alertasExistentes.forEach(alerta => alerta.remove());
    
    const alerta = document.createElement('div');
    alerta.className = `alerta ${tipo}`;
    alerta.textContent = mensaje;
    
    document.body.appendChild(alerta);
    
    setTimeout(() => {
        alerta.remove();
    }, 3000);
}

/**
 * Genera un PDF con el reporte de ventas
 */
async function generarPDF() {
    try {
        mostrarAlerta("Generando PDF...", "warning");
        
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

        // Logo - Usamos una URL directa si está disponible o un placeholder
        try {
            // Intenta cargar el logo desde la misma ubicación que en la web
            const logoData = await getBase64Image('img/crepas-logo.png');
            doc.addImage(logoData, 'PNG', centerX - 15, currentY, 30, 30);
            currentY += 32;
        } catch (error) {
            console.log("No se pudo cargar el logo, usando placeholder");
            // Si falla, usamos un texto como alternativa
            doc.setFontSize(16);
            doc.setTextColor(100, 100, 100);
            doc.text('Crepas Deliciosas', centerX, currentY + 15, { align: 'center' });
            currentY += 20;
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
        
        mostrarAlerta("PDF generado correctamente", "success");
    } catch (error) {
        console.error("Error al generar PDF:", error);
        mostrarAlerta("Error al generar el PDF", "error");
    }
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

// Exportar funciones al scope global para los botones en la tabla
window.abrirModalEdicion = abrirModalEdicion;
window.eliminarVenta = eliminarVenta;
window.generarPDF = generarPDF;