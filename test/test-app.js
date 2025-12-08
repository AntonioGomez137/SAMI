// ============================================
// CONFIGURACIÓN
// ============================================
const API_BASE_URL = 'http://localhost:5096/api';

// Mapeo de IDs de activos a nombres
const ACTIVOS_MAP = {
    1: 'Samaria',
    2: 'Muspac',
    3: '5P',
    4: 'Bellota',
    5: 'Poza Rica'
};

// Mapeo inverso (nombre a ID)
const ACTIVOS_MAP_REVERSE = {
    'Samaria': 1,
    'Muspac': 2,
    '5P': 3,
    'Bellota': 4,
    'Poza Rica': 5
};

// Variables globales para almacenar datos
let todosLosPozos = [];
let todosTiposMTC = [];
let pozosFiltrados = [];

// ============================================
// UTILIDADES
// ============================================
function obtenerNombreActivo(fkIdActivo) {
    return ACTIVOS_MAP[fkIdActivo] || 'Desconocido';
}

function obtenerIdActivo(nombreActivo) {
    return ACTIVOS_MAP_REVERSE[nombreActivo] || null;
}

function actualizarEstado(mensaje, tipo = 'info') {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = mensaje;
    statusDiv.className = `status ${tipo}`;
    console.log(`[${tipo.toUpperCase()}]`, mensaje);
}

function mostrarJSON(data, titulo = 'Respuesta') {
    const output = document.getElementById('jsonOutput');
    output.textContent = `// ${titulo}\n` + JSON.stringify(data, null, 2);
    console.log(titulo, data);
}

function mostrarError(mensaje, error) {
    actualizarEstado(mensaje, 'error');
    const output = document.getElementById('jsonOutput');
    output.textContent = `❌ ERROR: ${mensaje}\n\n${error.message || error}`;
    console.error(mensaje, error);
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resaltarTexto(texto, termino) {
    if (!termino) return texto;
    const regex = new RegExp(`(${escapeRegex(termino)})`, 'gi');
    return texto.replace(regex, '<span class="highlight">$1</span>');
}

// ============================================
// FUNCIONES DE API
// ============================================

async function cargarTodosLosPozos() {
    try {
        actualizarEstado('Cargando pozos...', 'loading');
        
        const response = await fetch(`${API_BASE_URL}/Pozos`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} - ${response.statusText}`);
        }
        
        todosLosPozos = await response.json();
        pozosFiltrados = todosLosPozos;
        
        mostrarJSON(todosLosPozos, `Pozos cargados (${todosLosPozos.length})`);
        renderizarListaPozos(todosLosPozos);
        actualizarContadorResultados(todosLosPozos.length, todosLosPozos.length);
        
        // Mostrar estadísticas
        mostrarEstadisticasActivos();
        
        actualizarEstado(`✅ ${todosLosPozos.length} pozos cargados correctamente`, 'success');
        
    } catch (error) {
        mostrarError('Error al cargar pozos', error);
    }
}

function mostrarEstadisticasActivos() {
    const stats = {};
    
    todosLosPozos.forEach(pozo => {
        const nombreActivo = obtenerNombreActivo(pozo.fkIdActivo);
        if (!stats[nombreActivo]) {
            stats[nombreActivo] = { total: 0, activos: 0, inactivos: 0 };
        }
        stats[nombreActivo].total++;
        if (pozo.estatus) {
            stats[nombreActivo].activos++;
        } else {
            stats[nombreActivo].inactivos++;
        }
    });
    
    console.log('📊 Estadísticas por Activo:', stats);
}

async function cargarTiposMTC() {
    try {
        actualizarEstado('Cargando tipos de MTC...', 'loading');
        
        const response = await fetch(`${API_BASE_URL}/Tipos`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} - ${response.statusText}`);
        }
        
        todosTiposMTC = await response.json();
        
        mostrarJSON(todosTiposMTC, `Tipos MTC cargados (${todosTiposMTC.length})`);
        actualizarEstado(`✅ ${todosTiposMTC.length} tipos MTC cargados correctamente`, 'success');
        
    } catch (error) {
        mostrarError('Error al cargar tipos MTC', error);
    }
}

// ============================================
// FUNCIONES DE FILTRADO
// ============================================

function aplicarFiltros() {
    const termino = document.getElementById('searchInput').value.toLowerCase().trim();
    const activo = document.getElementById('activoSelect').value;
    
    pozosFiltrados = todosLosPozos.filter(pozo => {
        // Filtro por activo
        const cumpleActivo = !activo || obtenerNombreActivo(pozo.fkIdActivo) === activo;
        
        // Filtro por búsqueda (nombre o código)
        const nombrePozo = pozo.nombrePozo.toLowerCase();
        const codigoPozo = (pozo.abrvKepServer || '').toLowerCase();
        const cumpleBusqueda = !termino || 
            nombrePozo.includes(termino) || 
            codigoPozo.includes(termino);
        
        return cumpleActivo && cumpleBusqueda;
    });
    
    renderizarListaPozos(pozosFiltrados);
    actualizarContadorResultados(pozosFiltrados.length, todosLosPozos.length);
    
    if (termino) {
        resaltarTerminoBusqueda(termino);
    }
    
    console.log(`🔍 Filtros aplicados:`, {
        termino: termino || 'ninguno',
        activo: activo || 'todos',
        resultados: pozosFiltrados.length,
        total: todosLosPozos.length
    });
}

function actualizarContadorResultados(resultados, total) {
    const counter = document.getElementById('resultadosCount');
    
    if (resultados === total) {
        counter.textContent = `${total} pozos`;
        counter.style.background = '#667eea';
    } else if (resultados === 0) {
        counter.textContent = 'Sin resultados';
        counter.style.background = '#f44336';
    } else {
        counter.textContent = `${resultados} de ${total}`;
        counter.style.background = '#4caf50';
    }
}

function resaltarTerminoBusqueda(termino) {
    const items = document.querySelectorAll('.pozo-item');
    
    items.forEach(item => {
        const nombreElement = item.querySelector('.pozo-nombre');
        const infoElement = item.querySelector('.pozo-info');
        
        if (nombreElement) {
            const textoOriginal = nombreElement.getAttribute('data-original') || nombreElement.textContent;
            if (!nombreElement.getAttribute('data-original')) {
                nombreElement.setAttribute('data-original', textoOriginal);
            }
            nombreElement.innerHTML = resaltarTexto(textoOriginal, termino);
        }
        
        if (infoElement) {
            const textoOriginal = infoElement.getAttribute('data-original') || infoElement.textContent;
            if (!infoElement.getAttribute('data-original')) {
                infoElement.setAttribute('data-original', textoOriginal);
            }
            infoElement.innerHTML = resaltarTexto(textoOriginal, termino);
        }
    });
}

function limpiarFiltros() {
    document.getElementById('searchInput').value = '';
    document.getElementById('activoSelect').value = '';
    
    if (todosLosPozos.length > 0) {
        renderizarListaPozos(todosLosPozos);
        actualizarContadorResultados(todosLosPozos.length, todosLosPozos.length);
    }
    
    actualizarEstado('Filtros limpiados - Mostrando todos los pozos', 'info');
}

// ============================================
// FUNCIONES DE RENDERIZADO
// ============================================

function renderizarListaPozos(pozos) {
    const lista = document.getElementById('listaPozos');
    
    if (pozos.length === 0) {
        lista.innerHTML = `
            <div class="no-results">
                <p>❌ No se encontraron pozos con los criterios de búsqueda</p>
                <p style="font-size: 14px; margin-top: 10px;">
                    Intenta cambiar los filtros o limpiar la búsqueda
                </p>
            </div>
        `;
        return;
    }
    
    const html = pozos.map(pozo => {
        const nombreActivo = obtenerNombreActivo(pozo.fkIdActivo);
        const statusClass = pozo.estatus ? 'active' : 'inactive';
        const statusText = pozo.estatus ? 'Activo' : 'Inactivo';
        
        return `
            <div class="pozo-item ${statusClass}" onclick="seleccionarPozo(${pozo.idPozo})">
                <div class="pozo-nombre" data-original="${pozo.nombrePozo}">${pozo.nombrePozo}</div>
                <div class="pozo-info" data-original="ID: ${pozo.idPozo} | Activo: ${nombreActivo} | Status: ${statusText} | KepServer: ${pozo.abrvKepServer || 'N/A'}">
                    ID: ${pozo.idPozo} | 
                    Activo: ${nombreActivo} | 
                    Status: ${statusText} | 
                    KepServer: ${pozo.abrvKepServer || 'N/A'}
                </div>
            </div>
        `;
    }).join('');
    
    lista.innerHTML = html;
}

function mostrarDetallePozo(pozo) {
    document.getElementById('idPozo').value = pozo.idPozo || '';
    document.getElementById('nombrePozo').value = pozo.nombrePozo || '';
    document.getElementById('estatusPozo').value = pozo.estatus ? 'Activo' : 'Inactivo';
    document.getElementById('abrvKepServer').value = pozo.abrvKepServer || '';
    document.getElementById('activo').value = `${obtenerNombreActivo(pozo.fkIdActivo)} (ID: ${pozo.fkIdActivo})`;
    document.getElementById('fkIdSector').value = pozo.fkIdSector || 'N/A';
}

function mostrarEquipos(equipos) {
    const equipoPOZO = equipos.find(e => e.descripcion === 'POZO');
    document.getElementById('direccionIP').value = equipoPOZO?.direccionIp || 'No disponible';
    
    const otrosEquipos = equipos.filter(e => e.descripcion !== 'POZO');
    const container = document.getElementById('otrosEquipos');
    
    if (otrosEquipos.length > 0) {
        const html = `
            <h4 style="margin-bottom: 10px; color: #555;">Otros Equipos (${otrosEquipos.length}):</h4>
            ${otrosEquipos.map(equipo => `
                <div class="equipo-item">
                    <strong>${equipo.descripcion || 'Sin descripción'}</strong><br>
                    ID: ${equipo.idEquipo} | 
                    Identificador: ${equipo.identificador || 'N/A'} | 
                    IP: ${equipo.direccionIp || 'N/A'}
                    ${equipo.marca ? `<br>Marca: ${equipo.marca}` : ''}
                    ${equipo.modelo ? ` | Modelo: ${equipo.modelo}` : ''}
                </div>
            `).join('')}
        `;
        container.innerHTML = html;
    } else {
        container.innerHTML = '<p style="color: #999; font-style: italic;">No hay otros equipos registrados</p>';
    }
}

function mostrarDetalleMTC(mtc) {
    if (mtc) {
        document.getElementById('idTipoMtc').value = mtc.idTipoMtc || '';
        document.getElementById('descripcionMtc').value = mtc.descripcion || '';
        document.getElementById('patin').value = mtc.patin || '';
        document.getElementById('disponible').value = mtc.disponible === 1 ? 'OPERANDO' : 'DISPONIBLE';
        document.getElementById('fechaInstalacion').value = mtc.fechaInstalacion ? 
            new Date(mtc.fechaInstalacion).toLocaleDateString('es-MX') : '';
    } else {
        document.getElementById('idTipoMtc').value = 'N/A';
        document.getElementById('descripcionMtc').value = 'No asignado';
        document.getElementById('patin').value = 'N/A';
        document.getElementById('disponible').value = 'N/A';
        document.getElementById('fechaInstalacion').value = 'N/A';
    }
}

async function seleccionarPozo(idPozo) {
    try {
        // Marcar visualmente el pozo seleccionado
        document.querySelectorAll('.pozo-item').forEach(item => {
            item.classList.remove('selected');
        });
        event.target.closest('.pozo-item').classList.add('selected');
        
        actualizarEstado(`Cargando información completa del pozo ${idPozo}...`, 'loading');
        
        // Cargar todo en paralelo
        const [pozo, equipos, tiposMTC] = await Promise.all([
            fetch(`${API_BASE_URL}/Pozos/${idPozo}`).then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            }),
            fetch(`${API_BASE_URL}/Equipos/Pozo/${idPozo}`).then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            }),
            todosTiposMTC.length > 0 
                ? Promise.resolve(todosTiposMTC) 
                : fetch(`${API_BASE_URL}/Tipos`).then(r => r.json())
        ]);
        
        if (todosTiposMTC.length === 0) {
            todosTiposMTC = tiposMTC;
        }
        
        const mtc = todosTiposMTC.find(m => m.fkIdPozo === parseInt(idPozo));
        
        mostrarJSON({
            pozo,
            equipos,
            mtc,
            resumen: {
                nombrePozo: pozo.nombrePozo,
                activo: obtenerNombreActivo(pozo.fkIdActivo),
                totalEquipos: equipos.length,
                tieneIP: equipos.some(e => e.direccionIp),
                tieneMTC: !!mtc
            }
        }, `📦 Información Completa del Pozo ${idPozo}`);
        
        mostrarDetallePozo(pozo);
        mostrarEquipos(equipos);
        mostrarDetalleMTC(mtc);
        
        actualizarEstado(
            `✅ "${pozo.nombrePozo}" cargado: ${equipos.length} equipos encontrados`, 
            'success'
        );
        
    } catch (error) {
        mostrarError(`Error al cargar pozo ${idPozo}`, error);
        limpiarFormulario();
    }
}

function limpiarFormulario() {
    document.getElementById('formPozo').reset();
    document.getElementById('otrosEquipos').innerHTML = '';
}

// ============================================
// INICIALIZACIÓN
// ============================================
window.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Test App iniciada');
    console.log('📍 API Base URL:', API_BASE_URL);
    console.log('🏷️ Mapeo de Activos:', ACTIVOS_MAP);
    actualizarEstado('Listo para probar endpoints', 'info');
});

window.addEventListener('error', (event) => {
    console.error('Error global capturado:', event.error);
});
