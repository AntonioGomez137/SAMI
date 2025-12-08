// ============================================
// CONFIGURACIÓN Y CONSTANTES
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

const ACTIVOS_MAP_REVERSE = {
    'Samaria': 1,
    'Muspac': 2,
    '5P': 3,
    'Bellota': 4,
    'Poza Rica': 5
};

// Mapeo de estados MTC
const ESTADOS_MTC_MAP = {
    1: 'Operando',
    2: 'Disponible',
    3: 'Cancelado en Programa',
    4: 'De Baja',
    5: 'Cancelado'
};

// ============================================
// VARIABLES GLOBALES
// ============================================
let todosLosPozos = [];
let todosTiposMTC = [];
let pozosFiltrados = [];
let activoActual = 'Samaria';
let pozoSeleccionado = null;

// Referencias a gráficas para destruirlas al actualizar
let chartCantidad = null;
let chartPorcentaje = null;
let chartSectores = null;

// ============================================
// UTILIDADES
// ============================================
function obtenerNombreActivo(fkIdActivo) {
    return ACTIVOS_MAP[fkIdActivo] || 'Desconocido';
}

function obtenerIdActivo(nombreActivo) {
    return ACTIVOS_MAP_REVERSE[nombreActivo] || null;
}

function formatearFecha(fecha) {
    if (!fecha) return '';
    return new Date(fecha).toLocaleDateString('es-MX');
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
        console.log('📋 Cargando todos los pozos...');
        const response = await fetch(`${API_BASE_URL}/Pozos`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} - ${response.statusText}`);
        }

        const pozos = await response.json();
        console.log(`✅ ${pozos.length} pozos cargados correctamente`, pozos);
        return pozos;
    } catch (error) {
        console.error('❌ Error al cargar pozos:', error);
        throw error;
    }
}

async function cargarTiposMTC() {
    try {
        console.log('🏷️ Cargando tipos de MTC...');
        const response = await fetch(`${API_BASE_URL}/Tipos`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} - ${response.statusText}`);
        }

        const tipos = await response.json();
        console.log(`✅ ${tipos.length} tipos MTC cargados correctamente`, tipos);
        return tipos;
    } catch (error) {
        console.error('❌ Error al cargar tipos MTC:', error);
        throw error;
    }
}

async function cargarInformacionCompletaPozo(idPozo) {
    try {
        console.log(`📦 Cargando información completa del pozo ${idPozo}...`);

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

        const mtc = tiposMTC.find(m => m.fkIdPozo === parseInt(idPozo));

        const infoCompleta = {
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
        };

        console.log(`✅ Información completa del pozo ${idPozo} cargada`, infoCompleta);
        return infoCompleta;
    } catch (error) {
        console.error(`❌ Error al cargar información completa del pozo ${idPozo}:`, error);
        throw error;
    }
}

async function actualizarDireccionIP(idEquipo, nuevaIP) {
    try {
        console.log(`🔄 Actualizando IP del equipo ${idEquipo} a ${nuevaIP}...`);

        const response = await fetch(`${API_BASE_URL}/Equipos/${idEquipo}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                direccionIp: nuevaIP
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} - ${response.statusText}`);
        }

        const resultado = await response.json();
        console.log('✅ IP actualizada correctamente', resultado);
        return resultado;
    } catch (error) {
        console.error(`❌ Error al actualizar IP del equipo ${idEquipo}:`, error);
        throw error;
    }
}

// ============================================
// NAVEGACIÓN ENTRE VISTAS
// ============================================
function cambiarVista(vistaName) {
    // Remover active de todas las vistas y tabs
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

    // Activar vista y tab seleccionado
    document.getElementById(`${vistaName}-view`).classList.add('active');
    event.target.classList.add('active');

    console.log(`👁️ Vista cambiada a: ${vistaName}`);

    // Inicializar cada vista según sea necesario
    if (vistaName === 'dashboard') {
        inicializarDashboard();
    }

    if (vistaName === 'gestion') {
        // Solo inicializar si no hay datos
        if (todosLosPozos.length === 0) {
            inicializarGestion();
        }
    }
}


// ============================================
// DASHBOARD - INICIALIZACIÓN
// ============================================
async function inicializarDashboard() {
    try {
        console.log('🚀 Inicializando Dashboard...');

        // Cargar datos si no están cargados
        if (todosLosPozos.length === 0 || todosTiposMTC.length === 0) {
            const [pozos, tipos] = await Promise.all([
                cargarTodosLosPozos(),
                cargarTiposMTC()
            ]);
            todosLosPozos = pozos;
            todosTiposMTC = tipos;
        }

        // Actualizar KPIs
        actualizarKPIs();

        // Generar gráficas
        generarGraficas();

        console.log('✅ Dashboard inicializado correctamente');
    } catch (error) {
        console.error('❌ Error al inicializar Dashboard:', error);
        alert('Error al cargar datos del dashboard');
    }
}

function actualizarKPIs() {
    // Calcular estadísticas
    const total = todosTiposMTC.length;
    const operando = todosTiposMTC.filter(t => t.disponible === 1).length;
    const disponible = todosTiposMTC.filter(t => t.disponible === 2).length;
    const activos = new Set(todosLosPozos.map(p => obtenerNombreActivo(p.fkIdActivo))).size;

    // Actualizar DOM
    document.getElementById('kpiTotal').textContent = total;
    document.getElementById('kpiOperando').textContent = operando;
    document.getElementById('kpiDisponible').textContent = disponible;
    document.getElementById('kpiActivos').textContent = activos;

    console.log('📊 KPIs actualizados:', { total, operando, disponible, activos });
}

function generarGraficas() {
    // Contar MTC por estado
    const estadosMTC = {
        operando: todosTiposMTC.filter(t => t.disponible === 1).length,
        disponible: todosTiposMTC.filter(t => t.disponible === 2).length,
        canceladoPrograma: todosTiposMTC.filter(t => t.disponible === 3).length,
        deBaja: todosTiposMTC.filter(t => t.disponible === 4).length,
        cancelado: todosTiposMTC.filter(t => t.disponible === 5).length
    };

    // Total de MTC para calcular porcentajes
    const totalMTC = todosTiposMTC.length;

    console.log('📊 Estadísticas de MTC por estado:', estadosMTC);

    // Datos por activo (pozos activos/inactivos)
    const datosPorActivo = {};
    todosLosPozos.forEach(pozo => {
        const activo = obtenerNombreActivo(pozo.fkIdActivo);
        if (!datosPorActivo[activo]) {
            datosPorActivo[activo] = { activos: 0, inactivos: 0 };
        }
        if (pozo.estatus) {
            datosPorActivo[activo].activos++;
        } else {
            datosPorActivo[activo].inactivos++;
        }
    });

    const labels = Object.keys(datosPorActivo);
    const activos = labels.map(k => datosPorActivo[k].activos);
    const inactivos = labels.map(k => datosPorActivo[k].inactivos);

    // ========================================
    // GRÁFICA 1: Cantidad por Estado
    // ========================================
    const ctxCantidad = document.getElementById('chartCantidadEstados').getContext('2d');
    if (chartCantidad) chartCantidad.destroy();

    chartCantidad = new Chart(ctxCantidad, {
        type: 'bar',
        data: {
            labels: [
                'Operando',
                'Disponible',
                'Cancelado en Programa',
                'De Baja',
                'Cancelado'
            ],
            datasets: [{
                label: 'Cantidad de MTC',
                data: [
                    estadosMTC.operando,
                    estadosMTC.disponible,
                    estadosMTC.canceladoPrograma,
                    estadosMTC.deBaja,
                    estadosMTC.cancelado
                ],
                backgroundColor: [
                    '#4caf50',  // Verde - Operando
                    '#4a9eff',  // Azul - Disponible
                    '#ff9800',  // Naranja - Cancelado en Programa
                    '#f44336',  // Rojo - De Baja
                    '#757575'   // Gris - Cancelado
                ],
                borderRadius: 6,
                barThickness: 30
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Cantidad de MTC por Estado Administrativo',
                    color: '#e0e0e0',
                    font: { size: 16, weight: 'bold' },
                    padding: { bottom: 20 }
                },
                tooltip: {
                    backgroundColor: '#1f1f1f',
                    padding: 12,
                    titleColor: '#4a9eff',
                    bodyColor: '#e0e0e0',
                    callbacks: {
                        label: function (context) {
                            const value = context.parsed.x;
                            const percentage = totalMTC > 0
                                ? ((value / totalMTC) * 100).toFixed(1)
                                : 0;
                            return `${value} MTC (${percentage}%)`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: '#3a3a3a' },
                    ticks: { color: '#999', stepSize: 1 },
                    beginAtZero: true
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#e0e0e0' }
                }
            }
        }
    });

    // ========================================
    // GRÁFICA 2: Porcentaje por Estado
    // ========================================
    const ctxPorcentaje = document.getElementById('chartPorcentajeEstados').getContext('2d');
    if (chartPorcentaje) chartPorcentaje.destroy();

    chartPorcentaje = new Chart(ctxPorcentaje, {
        type: 'doughnut',
        data: {
            labels: [
                'Operando',
                'Disponible',
                'Cancelado en Programa',
                'De Baja',
                'Cancelado'
            ],
            datasets: [{
                data: [
                    estadosMTC.operando,
                    estadosMTC.disponible,
                    estadosMTC.canceladoPrograma,
                    estadosMTC.deBaja,
                    estadosMTC.cancelado
                ],
                backgroundColor: [
                    '#4caf50',  // Verde - Operando
                    '#4a9eff',  // Azul - Disponible
                    '#ff9800',  // Naranja - Cancelado en Programa
                    '#f44336',  // Rojo - De Baja
                    '#757575'   // Gris - Cancelado
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#e0e0e0',
                        padding: 15,
                        font: { size: 12 }
                    }
                },
                title: {
                    display: true,
                    text: 'Distribución Porcentual de Estados MTC',
                    color: '#e0e0e0',
                    font: { size: 16, weight: 'bold' },
                    padding: { bottom: 20 }
                },
                tooltip: {
                    backgroundColor: '#1f1f1f',
                    padding: 12,
                    callbacks: {
                        label: function (context) {
                            const value = context.parsed;
                            const percentage = totalMTC > 0
                                ? ((value / totalMTC) * 100).toFixed(1)
                                : 0;
                            return `${context.label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });

    // ========================================
    // GRÁFICA 3: Pozos por Activo
    // ========================================
    const ctxSectores = document.getElementById('chartPozosSector').getContext('2d');
    if (chartSectores) chartSectores.destroy();

    chartSectores = new Chart(ctxSectores, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Pozos Activos',
                    data: activos,
                    backgroundColor: '#4caf50',
                    borderRadius: 4
                },
                {
                    label: 'Pozos Inactivos',
                    data: inactivos,
                    backgroundColor: '#f44336',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#e0e0e0',
                        padding: 15
                    }
                },
                title: {
                    display: true,
                    text: 'Pozos Activos e Inactivos por Activo',
                    color: '#e0e0e0',
                    font: { size: 16, weight: 'bold' },
                    padding: { bottom: 20 }
                },
                tooltip: {
                    backgroundColor: '#1f1f1f',
                    padding: 12
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#e0e0e0' },
                    stacked: false
                },
                y: {
                    grid: { color: '#3a3a3a' },
                    ticks: { color: '#999', stepSize: 1 },
                    beginAtZero: true
                }
            }
        }
    });

    console.log('📈 Gráficas generadas correctamente');
}

// ============================================
// GESTIÓN - INICIALIZACIÓN
// ============================================
async function inicializarGestion() {
    try {
        console.log('🚀 Inicializando Gestión...');

        // Cargar datos si no están cargados
        if (todosLosPozos.length === 0 || todosTiposMTC.length === 0) {
            const [pozos, tipos] = await Promise.all([
                cargarTodosLosPozos(),
                cargarTiposMTC()
            ]);
            todosLosPozos = pozos;
            todosTiposMTC = tipos;
        }

        // Configurar eventos ANTES de filtrar
        configurarEventos();

        // Filtrar por Samaria por defecto
        filtrarPorActivo('Samaria');

        console.log('✅ Gestión inicializada correctamente - Mostrando Samaria');
    } catch (error) {
        console.error('❌ Error al inicializar Gestión:', error);
        alert('Error al cargar datos de gestión');
    }
}

function configurarEventos() {
    const mtcList = document.getElementById('mtcList');
    const searchInput = document.getElementById('searchInput');

    if (!mtcList || !searchInput) {
        console.error('❌ No se encontraron elementos mtcList o searchInput');
        return;
    }

    // Click en item de pozo
    mtcList.addEventListener('click', async (e) => {
        const item = e.target.closest('.motocompresor-item');
        if (!item || item.style.display === 'none') return;

        await seleccionarPozo(item);
    });

    // Búsqueda en tiempo real
    searchInput.addEventListener('input', (e) => {
        buscarPozos(e.target.value);
    });

    configurarBusquedaVoz();
}

// ============================================
// RECONOCIMIENTO DE VOZ
// ============================================
function configurarBusquedaVoz() {
    const btnVoice = document.getElementById('btnVoiceSearch');
    const searchInput = document.getElementById('searchInput');

    // Verificar si el navegador soporta la API (Chrome, Edge, Android)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!btnVoice || !searchInput) return;

    if (!SpeechRecognition) {
        console.warn("Tu navegador no soporta reconocimiento de voz.");
        btnVoice.style.display = 'none'; // Ocultar si no es compatible
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-MX'; // Español México
    recognition.continuous = false; // Escuchar una frase y detenerse

    // Evento Click: Iniciar escucha
    btnVoice.addEventListener('click', () => {
        try {
            recognition.start();
            btnVoice.style.color = '#4a9eff'; // Poner azul mientras escucha
            searchInput.placeholder = "Escuchando...";
        } catch (error) {
            console.error("Error al iniciar voz:", error);
        }
    });

    // Evento Resultado: Cuando detecta texto
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log("Voz detectada:", transcript);
        
        // 1. Poner texto en el input
        searchInput.value = transcript;
        
        // 2. Disparar tu función de búsqueda existente
        buscarPozos(transcript);
        
        // Resetear estilos
        btnVoice.style.color = '#999';
        searchInput.placeholder = "Buscar...";
    };

    // Evento Fin: Si deja de escuchar (por silencio o error)
    recognition.onend = () => {
        btnVoice.style.color = '#999';
        searchInput.placeholder = "Buscar...";
    };
}


// ============================================
// GESTIÓN - FILTRADO POR ACTIVO
// ============================================
function filtrarPorActivo(activo) {
    activoActual = activo;
    pozoSeleccionado = null;

    console.log(`🎯 Filtrando por activo: ${activo}`);

    // Actualizar botones activos
    document.querySelectorAll('.btn-activo').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.activo === activo) {
            btn.classList.add('active');
        }
    });

    // Obtener ID del activo
    const idActivo = obtenerIdActivo(activo);

    // Filtrar pozos por fkIdActivo
    pozosFiltrados = todosLosPozos.filter(p => p.fkIdActivo === idActivo);

    console.log(`📋 ${pozosFiltrados.length} pozos encontrados en ${activo}`);

    // Renderizar lista
    renderizarListaPozos(pozosFiltrados);

    // Resetear UI
    document.querySelectorAll('.motocompresor-item').forEach(el => {
        el.classList.remove('active');
    });

    const emptyState = document.getElementById('emptyState');
    const detailView = document.getElementById('detailView');
    const searchInput = document.getElementById('searchInput');

    if (emptyState) emptyState.style.display = 'flex';
    if (detailView) detailView.classList.remove('active');
    if (searchInput) searchInput.value = '';

    // Actualizar título y breadcrumb
    actualizarUIActivo(activo);
}

function renderizarListaPozos(pozos) {
    const mtcList = document.getElementById('mtcList');
    const pozosCount = document.getElementById('pozosCount');

    if (!mtcList || !pozosCount) {
        console.error('❌ No se encontraron elementos mtcList o pozosCount');
        return;
    }

    if (pozos.length === 0) {
        mtcList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No hay pozos en este activo</div>';
        pozosCount.textContent = '0';
        return;
    }

    const html = pozos.map(pozo => {
        const mtc = todosTiposMTC.find(m => m.fkIdPozo === pozo.idPozo);
        const disponible = mtc?.disponible === 1;
        const statusClass = disponible ? 'status-disponible' : 'status-no-disponible';
        const nombreActivo = obtenerNombreActivo(pozo.fkIdActivo);

        return `
            <div class="motocompresor-item ${statusClass}" 
                 data-id="${pozo.idPozo}" 
                 data-activo="${nombreActivo}">
                <div class="mtc-name">${pozo.nombrePozo}</div>
                <div class="mtc-code">${pozo.abrvKepServer || 'N/A'}</div>
            </div>
        `;
    }).join('');

    mtcList.innerHTML = html;
    pozosCount.textContent = pozos.length;

    console.log(`✅ ${pozos.length} pozos renderizados en la lista`);
}

// ============================================
// GESTIÓN - BÚSQUEDA
// ============================================
function buscarPozos(termino) {
    const items = document.querySelectorAll('.motocompresor-item');
    const terminoLower = termino.toLowerCase().trim();

    let visibles = 0;

    items.forEach(item => {
        const nombre = item.querySelector('.mtc-name').textContent.toLowerCase();
        const codigo = item.querySelector('.mtc-code').textContent.toLowerCase();

        if (!terminoLower || nombre.includes(terminoLower) || codigo.includes(terminoLower)) {
            item.style.display = 'block';
            visibles++;
        } else {
            item.style.display = 'none';
        }
    });

    console.log(`🔍 Búsqueda "${termino}": ${visibles} resultados`);
}



// ============================================
// GESTIÓN - SELECCIÓN DE POZO
// ============================================
async function seleccionarPozo(item) {
    try {
        // Marcar visualmente
        document.querySelectorAll('.motocompresor-item').forEach(el => {
            el.classList.remove('active');
        });
        item.classList.add('active');

        // Ocultar empty state y mostrar detalle
        const emptyState = document.getElementById('emptyState');
        const detailView = document.getElementById('detailView');

        if (emptyState) emptyState.style.display = 'none';
        if (detailView) detailView.classList.add('active');

        const idPozo = parseInt(item.dataset.id);
        const pozoNombre = item.querySelector('.mtc-name').textContent;

        pozoSeleccionado = { id: idPozo, nombre: pozoNombre };

        console.log(`👆 Pozo seleccionado: ${pozoNombre} (ID: ${idPozo})`);

        // Cargar información completa
        const info = await cargarInformacionCompletaPozo(idPozo);

        // Actualizar UI
        actualizarUIActivo(activoActual, pozoNombre);
        mostrarDatosEnFormulario(info);

    } catch (error) {
        console.error('❌ Error al seleccionar pozo:', error);
        alert('Error al cargar información del pozo');
    }
}

function mostrarDatosEnFormulario(info) {
    const { pozo, equipos, mtc } = info;

    // SECCIÓN POZO
    const nombrePozo = document.getElementById('nombrePozo');
    const estatusPozo = document.getElementById('estatusPozo');
    const esclavo = document.getElementById('esclavo');
    const sector = document.getElementById('sector');

    if (nombrePozo) nombrePozo.value = pozo.nombrePozo || '';
    if (estatusPozo) estatusPozo.value = pozo.estatus ? '1' : '0';
    if (esclavo) esclavo.value = pozo.abrvKepServer || '';
    if (sector) sector.value = pozo.fkIdSector || '';

    // SECCIÓN MTC
    const descripcion = document.getElementById('descripcion');
    const patin = document.getElementById('patin');
    const disponible = document.getElementById('disponible');
    const fechaInstalacion = document.getElementById('fechaInstalacion');

    if (mtc) {
        if (descripcion) descripcion.value = mtc.descripcion || '';
        if (patin) patin.value = mtc.patin || '';
        if (disponible) disponible.value = mtc.disponible || '';
        if (fechaInstalacion) fechaInstalacion.value = mtc.fechaInstalacion ?
            mtc.fechaInstalacion.split('T')[0] : '';
    } else {
        if (descripcion) descripcion.value = '';
        if (patin) patin.value = '';
        if (disponible) disponible.value = '';
        if (fechaInstalacion) fechaInstalacion.value = '';
    }

    // SECCIÓN IP
    const equipoPOZO = equipos.find(e => e.descripcion === 'POZO');
    const inputIP = document.getElementById('direccionIP');

    if (inputIP) {
        inputIP.value = equipoPOZO?.direccionIp || '';
        // Guardar ID del equipo para actualización
        if (equipoPOZO) {
            inputIP.dataset.idEquipo = equipoPOZO.idEquipo;
        }
    }

    console.log('✅ Formulario actualizado con datos del pozo');
}

function actualizarUIActivo(activo, pozoNombre = null) {
    const activoNombre = document.getElementById('activoNombre');
    const mainTitle = document.getElementById('mainTitle');
    const breadcrumb = document.getElementById('breadcrumb');

    if (activoNombre) activoNombre.textContent = activo;

    if (pozoNombre) {
        if (mainTitle) mainTitle.textContent = `${pozoNombre} - ${activo}`;
        if (breadcrumb) breadcrumb.innerHTML = `
            <div class="breadcrumb-item">
                <span>Sistema</span>
                <span class="breadcrumb-separator">›</span>
                <span>${activo}</span>
                <span class="breadcrumb-separator">›</span>
                <span class="breadcrumb-current">${pozoNombre}</span>
            </div>
        `;
    } else {
        if (mainTitle) mainTitle.textContent = `Activo: ${activo}`;
        if (breadcrumb) breadcrumb.innerHTML = `
            <div class="breadcrumb-item">
                <span>Sistema</span>
                <span class="breadcrumb-separator">›</span>
                <span class="breadcrumb-current">${activo}</span>
            </div>
        `;
    }
}

// ============================================
// FUNCIONES DE ACTUALIZACIÓN (BOTONES)
// ============================================
function actualizarPozo() {
    if (!pozoSeleccionado) {
        alert('No hay un pozo seleccionado');
        return;
    }

    const datos = {
        nombrePozo: document.getElementById('nombrePozo').value,
        estatus: document.getElementById('estatusPozo').value,
        esclavo: document.getElementById('esclavo').value,
        sector: document.getElementById('sector').value
    };

    console.log('🔄 Actualizando Pozo:', datos);
    alert('Función de actualización de Pozo - Por implementar con endpoint PUT');
}

function actualizarMTC() {
    if (!pozoSeleccionado) {
        alert('No hay un pozo seleccionado');
        return;
    }

    const datos = {
        descripcion: document.getElementById('descripcion').value,
        patin: document.getElementById('patin').value,
        disponible: document.getElementById('disponible').value,
        fechaInstalacion: document.getElementById('fechaInstalacion').value
    };

    console.log('🔄 Actualizando MTC:', datos);
    alert('Función de actualización de MTC - Por implementar con endpoint PUT');
}

async function actualizarIP() {
    if (!pozoSeleccionado) {
        alert('No hay un pozo seleccionado');
        return;
    }

    try {
        const inputIP = document.getElementById('direccionIP');
        const nuevaIP = inputIP.value;
        const idEquipo = inputIP.dataset.idEquipo;

        if (!idEquipo) {
            alert('No se encontró el ID del equipo');
            return;
        }

        if (!nuevaIP) {
            alert('Por favor ingresa una dirección IP válida');
            return;
        }

        // Llamar al endpoint PUT
        await actualizarDireccionIP(idEquipo, nuevaIP);

        alert('✅ Dirección IP actualizada correctamente');

    } catch (error) {
        console.error('❌ Error al actualizar IP:', error);
        alert('Error al actualizar la dirección IP');
    }
}

// ============================================
// EXPONER FUNCIONES GLOBALMENTE PARA EL HTML
// ============================================
window.cambiarVista = cambiarVista;
window.filtrarPorActivo = filtrarPorActivo;
window.actualizarPozo = actualizarPozo;
window.actualizarMTC = actualizarMTC;
window.actualizarIP = actualizarIP;

// ============================================
// INICIALIZACIÓN
// ============================================
window.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Sistema de Motocompresores iniciado');
    console.log('✅ Funciones expuestas globalmente');

    // Cargar GESTIÓN por defecto (no dashboard)
    inicializarGestion();
});
