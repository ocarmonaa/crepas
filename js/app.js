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
    
    const nombre = document.getElementById('nombre').value;
    const bolsas = parseInt(document.getElementById('bolsas').value);
    const fechaInput = document.getElementById('fecha').value;
    const montoPagado = parseFloat(document.getElementById('montoPagado').value);
    const comentarios = document.getElementById('comentarios').value;
    
    // Ajuste de fecha para evitar problemas de zona horaria
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
    
    try {
        await venta.save();
        mostrarAlerta("Venta guardada correctamente", "success");
        document.getElementById('ventaForm').reset();
        document.getElementById('resumenVenta').innerHTML = "<p>Complete el formulario para ver el resumen</p>";
        cargarVentas();
    } catch (error) {
        console.error("Error al guardar la venta:", error);
        mostrarAlerta("Error al guardar la venta", "error");
    }
}

/**
 * Carga todas las ventas desde la base de datos
 */
async function cargarVentas() {
    try {
        const query = new Parse.Query(Venta);
        query.descending("createdAt");
        const results = await query.find();
        
        ventas = results.map(venta => ({
            id: venta.id,
            nombre: venta.get("nombre"),
            bolsas: venta.get("bolsas"),
            total: venta.get("total"),
            montoPagado: venta.get("montoPagado"),
            restante: venta.get("restante"),
            fecha: venta.get("fecha"),
            comentarios: venta.get("comentarios"),
            createdAt: venta.createdAt
        }));
        
        mostrarVentas(ventas);
    } catch (error) {
        console.error("Error al cargar ventas:", error);
        mostrarAlerta("Error al cargar las ventas", "error");
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
        document.getElementById('editarNombre').value = venta.get("nombre");
        document.getElementById('editarBolsas').value = venta.get("bolsas");
        
        // Ajuste de fecha para el input date
        const fecha = new Date(venta.get("fecha"));
        const fechaLocal = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        document.getElementById('editarFecha').value = fechaLocal;
        
        document.getElementById('editarMontoPagado').value = venta.get("montoPagado");
        document.getElementById('editarComentarios').value = venta.get("comentarios") || '';
        
        // Mostrar el modal
        document.getElementById('modalEditar').style.display = 'block';
    } catch (error) {
        console.error("Error al cargar venta para editar:", error);
        mostrarAlerta("Error al cargar la venta para editar", "error");
    }
}

/**
 * Actualiza una venta existente en la base de datos
 * @param {Event} e - Evento del formulario
 */
async function actualizarVenta(e) {
    e.preventDefault();
    
    if (!ventaEditando) return;
    
    const nombre = document.getElementById('editarNombre').value;
    const bolsas = parseInt(document.getElementById('editarBolsas').value);
    const fechaInput = document.getElementById('editarFecha').value;
    const montoPagado = parseFloat(document.getElementById('editarMontoPagado').value);
    const comentarios = document.getElementById('editarComentarios').value;
    
    // Ajuste de fecha para evitar problemas de zona horaria
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
    
    try {
        await ventaEditando.save();
        mostrarAlerta("Venta actualizada correctamente", "success");
        cerrarModal();
        cargarVentas();
    } catch (error) {
        console.error("Error al actualizar la venta:", error);
        mostrarAlerta("Error al actualizar la venta", "error");
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
        cargarVentas();
    } catch (error) {
        console.error("Error al eliminar la venta:", error);
        mostrarAlerta("Error al eliminar la venta", "error");
    }
}

/**
 * Muestra una alerta temporal en la pantalla
 * @param {string} mensaje - Mensaje a mostrar
 * @param {string} tipo - Tipo de alerta (success, error, warning)
 */
function mostrarAlerta(mensaje, tipo) {
    const alerta = document.createElement('div');
    alerta.className = `alerta ${tipo}`;
    alerta.textContent = mensaje;
    
    document.body.appendChild(alerta);
    
    setTimeout(() => {
        alerta.remove();
    }, 3000);
}

// Exportar funciones al scope global para los botones en la tabla
window.abrirModalEdicion = abrirModalEdicion;
window.eliminarVenta = eliminarVenta;