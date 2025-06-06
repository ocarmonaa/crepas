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

// Configuración inicial de Parse (Back4App)
(function() {
    // Configuración de Back4App
    Parse.initialize("Q7mqUi5d3hYple1dlpp8mqhFuD1Wa66IM5Vw5r0I", "O5Lr8077OH6wSw0RY2SIECRNmYstN6X1onNtrZTo");
    Parse.serverURL = "https://parseapi.back4app.com/";
})();

// Modelo de datos para las ventas
const Venta = Parse.Object.extend("Venta");

// Precio por bolsa (constante)
const PRECIO_BOLSA = 90;

// Variables globales
let ventas = []; // Almacena todas las ventas cargadas
let ventaEditando = null; // Almacena la venta que se está editando

/**
 * Inicialización de la aplicación cuando el DOM está listo
 */
document.addEventListener('DOMContentLoaded', function() {
    inicializarFecha();
    configurarEventListeners();
    cargarVentas();
});

/**
 * Inicializa la fecha por defecto en el formulario
 */
function inicializarFecha() {
    const fechaInput = document.getElementById('fecha');
    const filtroFechaInput = document.getElementById('filtroFecha');
    const hoy = new Date();
    const fechaLocal = new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    
    fechaInput.value = fechaLocal;
    filtroFechaInput.value = fechaLocal;
}

/**
 * Configura todos los event listeners de la aplicación
 */
function configurarEventListeners() {
    // Formulario principal
    document.getElementById('ventaForm').addEventListener('submit', guardarVenta);
    document.getElementById('bolsas').addEventListener('input', actualizarResumen);
    document.getElementById('montoPagado').addEventListener('input', actualizarResumen);
    
    // Botones
    document.getElementById('btnImprimir').addEventListener('click', generarPDF);
    document.getElementById('btnFiltrar').addEventListener('click', filtrarPorFecha);
    document.getElementById('btnLimpiarFiltro').addEventListener('click', cargarVentas);
    
    // Modal de edición
    document.querySelector('.close-modal').addEventListener('click', cerrarModal);
    document.querySelector('.cancelar-edicion').addEventListener('click', cerrarModal);
    document.getElementById('editarForm').addEventListener('submit', actualizarVenta);
    
    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', function(event) {
        if (event.target === document.getElementById('modalEditar')) {
            cerrarModal();
        }
    });
}

/**
 * Funciones de cálculo y actualización de la interfaz
 */

function calcularTotal(bolsas) {
    return bolsas * PRECIO_BOLSA;
}

function calcularRestante(total, pagado) {
    return Math.max(total - pagado, 0);
}

function actualizarResumen() {
    const bolsas = parseInt(document.getElementById('bolsas').value) || 0;
    const montoPagado = parseFloat(document.getElementById('montoPagado').value) || 0;
    const total = calcularTotal(bolsas);
    const restante = calcularRestante(total, montoPagado);
    
    document.getElementById('resumenVenta').innerHTML = `
        <p><strong>Cliente:</strong> ${document.getElementById('nombre').value || 'No especificado'}</p>
        <p><strong>Bolsas:</strong> ${bolsas}</p>
        <p><strong>Total a pagar:</strong> $${total.toFixed(2)}</p>
        <p><strong>Monto pagado:</strong> $${montoPagado.toFixed(2)}</p>
        <p class="${restante > 0 ? 'pendiente' : 'completo'}">
            <strong>Restante:</strong> $${restante.toFixed(2)}
        </p>
    `;
}

/**
 * Funciones para manejar ventas (CRUD)
 */

async function guardarVenta(e) {
    e.preventDefault();
    
    const nombre = document.getElementById('nombre').value.trim();
    const bolsas = parseInt(document.getElementById('bolsas').value);
    const fechaInput = document.getElementById('fecha').value;
    const montoPagado = parseFloat(document.getElementById('montoPagado').value) || 0;
    const comentarios = document.getElementById('comentarios').value.trim();
    
    // Validación
    if (!nombre || isNaN(bolsas) || bolsas < 1) {
        mostrarAlerta("Por favor complete todos los campos requeridos", "warning");
        return;
    }
    
    try {
        const fecha = new Date(fechaInput);
        fecha.setMinutes(fecha.getMinutes() + fecha.getTimezoneOffset());
        
        const total = calcularTotal(bolsas);
        const restante = calcularRestante(total, montoPagado);
        
        const venta = new Venta();
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
 * Funciones para el modal de edición
 */

async function abrirModalEdicion(id) {
    try {
        const query = new Parse.Query(Venta);
        const venta = await query.get(id);
        
        ventaEditando = venta;
        
        document.getElementById('editarId').value = venta.id;
        document.getElementById('editarNombre').value = venta.get("nombre") || '';
        document.getElementById('editarBolsas').value = venta.get("bolsas") || 0;
        
        const fecha = new Date(venta.get("fecha"));
        const fechaLocal = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        document.getElementById('editarFecha').value = fechaLocal;
        
        document.getElementById('editarMontoPagado').value = venta.get("montoPagado") || 0;
        document.getElementById('editarComentarios').value = venta.get("comentarios") || '';
        
        document.getElementById('modalEditar').style.display = 'block';
    } catch (error) {
        console.error("Error al cargar venta para editar:", error);
        mostrarAlerta(`Error al cargar la venta para editar: ${error.message}`, "error");
    }
}

async function actualizarVenta(e) {
    e.preventDefault();
    
    if (!ventaEditando) return;
    
    const nombre = document.getElementById('editarNombre').value.trim();
    const bolsas = parseInt(document.getElementById('editarBolsas').value);
    const fechaInput = document.getElementById('editarFecha').value;
    const montoPagado = parseFloat(document.getElementById('editarMontoPagado').value) || 0;
    const comentarios = document.getElementById('editarComentarios').value.trim();
    
    if (!nombre || isNaN(bolsas) || bolsas < 1) {
        mostrarAlerta("Por favor complete todos los campos requeridos correctamente", "warning");
        return;
    }
    
    try {
        const fecha = new Date(fechaInput);
        fecha.setMinutes(fecha.getMinutes() + fecha.getTimezoneOffset());
        
        const total = calcularTotal(bolsas);
        const restante = calcularRestante(total, montoPagado);
        
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

function cerrarModal() {
    document.getElementById('modalEditar').style.display = 'none';
    ventaEditando = null;
    document.getElementById('editarForm').reset();
}

/**
 * Funciones para eliminar ventas
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
 * Funciones auxiliares
 */

function mostrarAlerta(mensaje, tipo) {
    const alertasExistentes = document.querySelectorAll('.alerta');
    alertasExistentes.forEach(alerta => alerta.remove());
    
    const iconos = {
        success: '✅',
        error: '❌',
        warning: '⚠️'
    };
    
    const alerta = document.createElement('div');
    alerta.className = `alerta ${tipo}`;
    alerta.innerHTML = `<span>${iconos[tipo] || ''}</span> ${mensaje}`;
    
    document.body.appendChild(alerta);
    
    setTimeout(() => {
        alerta.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
            alerta.remove();
        }, 300);
    }, 3000);
}

/**
 * Funciones para generar PDF
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

        // Configuración del documento
        doc.setProperties({
            title: 'Reporte de Ventas de Crepas',
            subject: 'Ventas',
            author: 'Sistema de Control de Crepas',
            keywords: 'crepas, ventas, reporte',
            creator: 'Sistema de Control de Crepas'
        });

        const margin = 15;
        const pageWidth = doc.internal.pageSize.getWidth();
        const centerX = pageWidth / 2;
        let currentY = margin;

        // Título y fecha
        doc.setFontSize(20);
        doc.setTextColor(45, 45, 45);
        doc.setFont('helvetica', 'bold');
        doc.text('Reporte de Ventas de Crepas', centerX, currentY, { align: 'center' });
        currentY += 10;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generado el: ${new Date().toLocaleDateString('es-MX', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        })}`, centerX, currentY, { align: 'center' });
        currentY += 15;

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
                fillColor: [78, 205, 196],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 10
            },
            styles: {
                fontSize: 9,
                cellPadding: 3,
                textColor: [45, 45, 45]
            },
            alternateRowStyles: {
                fillColor: [245, 247, 250]
            }
        });

        // Totales
        const totalVentas = ventas.reduce((sum, venta) => sum + venta.total, 0);
        const totalPagado = ventas.reduce((sum, venta) => sum + venta.montoPagado, 0);
        const totalRestante = ventas.reduce((sum, venta) => sum + venta.restante, 0);
        
        const finalY = doc.lastAutoTable.finalY + 15;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Total ventas: $${totalVentas.toFixed(2)}`, margin, finalY);
        doc.text(`Total pagado: $${totalPagado.toFixed(2)}`, margin, finalY + 8);
        doc.text(`Total pendiente: $${totalRestante.toFixed(2)}`, margin, finalY + 16);

        // Pie de página
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('Sistema de Control de Ventas de Crepas CARFLOR COMPUTO', centerX, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

        // Guardar PDF
        doc.save(`reporte_ventas_${new Date().toISOString().split('T')[0]}.pdf`);
        mostrarAlerta("PDF generado correctamente", "success");
    } catch (error) {
        console.error("Error al generar PDF:", error);
        mostrarAlerta("Error al generar el PDF", "error");
    }
}

// Exportar funciones al scope global
window.abrirModalEdicion = abrirModalEdicion;
window.eliminarVenta = eliminarVenta;
window.generarPDF = generarPDF;
