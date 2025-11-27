const db = require('../../config/database');
const { enviarNotificacionAScretaria } = require('../../utils/notificaciones');
const moment = require('moment');

function generarHorariosLibres(inicio, fin, diasLaborales, feriados, ocupadasISO) {
    const libres = [];

    for (let d = new Date(inicio); d <= fin; d.setHours(d.getHours() + 1)) {
        const dia = d.getUTCDay();
        const fechaISO = d.toISOString().slice(0, 10);

        if (!diasLaborales.includes(dia)) continue;
        if (feriados.includes(fechaISO)) continue;

        const hora = d.toISOString().slice(0, 16);
        if (ocupadasISO.has(hora)) continue;

        libres.push({
            id: `disp-${hora}`,
            title: "Disponible",
            start: d.toISOString(),
            backgroundColor: "#28a745",
            borderColor: "#28a745",
            textColor: "white",
            extendedProps: { estado: "Disponible" }
        });
    }

    return libres;
}
exports.validarFechaDisponible = (req, res) => {
    const { idMedico, fecha } = req.query; // fecha = YYYY-MM-DD

    if (!idMedico || !fecha) {
        return res.status(400).json({
            disponible: false,
            motivo: "Faltan parámetros"
        });
    }

    const hoy = new Date().toISOString().slice(0, 10);
    if (fecha < hoy) {
        return res.json({
            disponible: false,
            motivo: "No podés elegir una fecha pasada"
        });
    }

    // Día de la semana (0 Domingo → 6 Sábado)
    const nombresDias = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
    const diaSemanaNombre = nombresDias[new Date(fecha).getDay()];

    // 1) Chequear días no laborables / feriados
    const qFeriado = `SELECT id FROM dias_no_laborables WHERE fecha = ?`;

    db.query(qFeriado, [fecha], (errF, feriado) => {
        if (errF) {
            console.error("Error feriados:", errF);
            return res.status(500).json({ disponible: false, motivo: "Error interno" });
        }

        if (feriado.length > 0) {
            return res.json({
                disponible: false,
                motivo: "La fecha seleccionada es un día no laborable"
            });
        }

        // 2) Chequear vacaciones del médico
        const qVac = `
            SELECT idVacacion 
            FROM vacaciones 
            WHERE idMedico = ?
            AND ? BETWEEN fechaInicio AND fechaFin
        `;

        db.query(qVac, [idMedico, fecha], (errV, vac) => {
            if (errV) {
                console.error("Error vacaciones:", errV);
                return res.status(500).json({ disponible: false, motivo: "Error interno" });
            }

            if (vac.length > 0) {
                return res.json({
                    disponible: false,
                    motivo: "El médico está de vacaciones en esa fecha"
                });
            }

            // 3) Chequear si el médico trabaja ese día
            const qHorario = `
                SELECT idHorarioEstandar 
                FROM horarios_estandar_medico
                WHERE idMedico = ?
                AND diaSemana = ?
            `;

            db.query(qHorario, [idMedico, diaSemanaNombre], (errH, horario) => {
                if (errH) {
                    console.error("Error horario:", errH);
                    return res.status(500).json({ disponible: false, motivo: "Error interno" });
                }

                if (horario.length === 0) {
                    return res.json({
                        disponible: false,
                        motivo: "El médico no atiende ese día"
                    });
                }

                // ✔ Fecha válida
                return res.json({ disponible: true });
            });
        });
    });
};


exports.listAll = (req, res) => {
    const { page = 1, limit = 10, estado, fechaInicio, fechaFin } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    let sql = `
        SELECT 
            citas.idCita, 
            medicos.nombre AS nombreMedico, 
            pacientes.nombre AS nombrePaciente, 
            citas.fechaHora, 
            citas.motivoConsulta, 
            citas.estado
        FROM citas
        JOIN medicos ON citas.idMedico = medicos.idMedico
        JOIN pacientes ON citas.idPaciente = pacientes.idPaciente
        WHERE 1 = 1
    `;

    // Filtro por estado
    if (estado) {
        sql += ` AND citas.estado = ?`;
        params.push(estado);
    }

    // Filtro por rango de fechas
    if (fechaInicio && fechaFin) {
        sql += ` AND citas.fechaHora BETWEEN ? AND ?`;
        params.push(fechaInicio, fechaFin);
    }

    // Agregar paginación
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    // Ejecutar consulta
    db.query(sql, params, (error, results) => {
        if (error) {
            console.error('Error al obtener las citas:', error);
            return res.status(500).send("Error al obtener las citas");
        }

        // Total de citas para calcular páginas
        db.query('SELECT COUNT(*) AS total FROM citas', (countError, countResults) => {
            if (countError) {
                console.error('Error al contar las citas:', countError);
                return res.status(500).send("Error al contar las citas");
            }

            const total = countResults[0].total;
            const totalPages = Math.ceil(total / limit);

            res.render('citas', {
                citas: results,
                total,
                totalPages,
                currentPage: parseInt(page)
            });
        });
    });
};

// Mostrar formulario para una nueva cita
exports.showNewForm = async (req, res) => {
    const usuario = req.session.user;

    if (!usuario) {
        return res.status(401).send('Usuario no autenticado');
    }

    try {
        // Consultas SQL para obtener especialidades y médicos con sus especialidades
        const [especialidades, medicos] = await Promise.all([
            new Promise((resolve, reject) => {
                db.query('SELECT * FROM especialidades', (err, results) => {
                    if (err) {
                        console.error('Error al obtener las especialidades:', err);
                        return reject(err);
                    }
                    resolve(results);
                });
            }),
            new Promise((resolve, reject) => {
                const sqlMedicos = `
                    SELECT 
                        medicos.idMedico, 
                        medicos.nombre, 
                        especialidades.nombre AS especialidad, 
                        medicos.telefono, 
                        medicos.email 
                    FROM medicos
                    LEFT JOIN especialidades ON medicos.idEspecialidad = especialidades.idEspecialidad
                `;
                db.query(sqlMedicos, (err, results) => {
                    if (err) {
                        console.error('Error al obtener los médicos:', err);
                        return reject(err);
                    }
                    resolve(results);
                });
            })
        ]);

        console.log('Especialidades obtenidas:', especialidades);
        console.log('Médicos obtenidos:', medicos);

        // Configuración de datos para la vista
        const renderData = {
            especialidades,
            medicos,
            nombrePaciente: null,
            idPaciente: null
        };

        if (usuario.role === 'paciente') {
            renderData.nombrePaciente = usuario.nombre;
            renderData.idPaciente = usuario.id;
        }

        res.render('newCita', renderData);

    } catch (error) {
        console.error('Error al cargar el formulario de nueva cita:', error);
        res.status(500).send('Error al cargar el formulario de nueva cita');
    }
};



exports.cargarConsulta = (req, res) => {
    const idCita = req.params.idCita;

    // Consulta para obtener la información de la cita y el paciente
    const sql = `
        SELECT citas.idCita, pacientes.nombre AS nombrePaciente, citas.fechaHora, citas.motivoConsulta
        FROM citas
        JOIN pacientes ON citas.idPaciente = pacientes.idPaciente
        WHERE citas.idCita = ?
    `;

    db.query(sql, [idCita], (error, results) => {
        if (error) {
            console.error('Error al cargar la consulta:', error);
            return res.status(500).send('Error al cargar la consulta');
        }

        if (results.length === 0) {
            return res.status(404).send('Cita no encontrada');
        }

        // Renderizar la vista de consulta
        res.render('consulta', {
            cita: results[0]
        });
    });
};

// Marcar automáticamente citas pasadas como "Completado"
exports.marcarCitasCompletadas = () => {
    const sql = `
        UPDATE citas
        SET estado = 'Completado'
        WHERE fechaHora < NOW() AND estado != 'Completado'
    `;

    db.query(sql, (error) => {
        if (error) {
            console.error('Error al marcar citas como completadas:', error);
        } else {
            console.log('Citas pasadas marcadas como "Completado".');
        }
    });
};

exports.countEnProceso = (req, res) => {
    const sql = "SELECT COUNT(*) AS count FROM citas WHERE estado = 'En proceso'";
    db.query(sql, (error, results) => {
        if (error) {
            console.error('Error al contar citas en proceso:', error);
            return res.status(500).send('Error al contar citas en proceso');
        }
        res.json({ count: results[0].count });
    });
};


// Mostrar los turnos del paciente autenticado
exports.listarMisTurnos = (req, res) => {
    const usuario = req.session.user;

    if (!usuario || usuario.role !== 'paciente') {
        return res.status(401).send('Acceso no autorizado');
    }

    const sql = `
        SELECT citas.idCita, citas.fechaHora, citas.motivoConsulta, citas.estado, medicos.nombre AS nombreMedico
        FROM citas
        JOIN medicos ON citas.idMedico = medicos.idMedico
        WHERE citas.idPaciente = ?
        ORDER BY citas.fechaHora DESC
    `;

    db.query(sql, [usuario.id], (error, results) => {
        if (error) {
            console.error('Error al obtener los turnos:', error);
            return res.status(500).send('Error al obtener los turnos');
        }

        res.render('misTurnos', { turnos: results });
    });
};

// Crear una nueva cita con validación de duplicados
// Crear una nueva cita con validación de duplicados
exports.createCita = (req, res) => {
    const { idPaciente, idMedico, fechaHora, motivoConsulta, tipoTurno } = req.body;

    // Validación de campos requeridos
    if (!idPaciente || !idMedico || !fechaHora || !motivoConsulta || !tipoTurno) {
        console.error('Error: Campos requeridos faltantes en la solicitud.');
        return res.status(400).send('Faltan datos requeridos para la cita.');
    }

    // Validación de formato de fecha
    const fechaHoraValida = Date.parse(fechaHora);
    if (isNaN(fechaHoraValida)) {
        console.error(`Error: Fecha y hora inválida recibida: ${fechaHora}`);
        return res.status(400).send('El formato de la fecha y hora no es válido.');
    }

    const sanitizedIdPaciente = parseInt(idPaciente, 10);
    const sanitizedIdMedico = parseInt(idMedico, 10);
    const sanitizedMotivoConsulta = motivoConsulta.trim();
    const sanitizedTipoTurno = tipoTurno.trim();

    if (isNaN(sanitizedIdPaciente) || isNaN(sanitizedIdMedico)) {
        console.error('Error: ID de paciente o médico inválido.');
        return res.status(400).send('ID de paciente o médico inválido.');
    }

    // 🔎 Validar si ya existe cita duplicada (check preventivo)
    const sqlCheck = `
        SELECT COUNT(*) AS existe 
        FROM citas 
        WHERE idPaciente = ? AND idMedico = ? AND fechaHora = ?
    `;
    db.query(sqlCheck, [sanitizedIdPaciente, sanitizedIdMedico, fechaHora], (err, results) => {
        if (err) {
            console.error('Error al verificar duplicados:', err);
            return res.status(500).send('Error al verificar duplicados.');
        }

        if (results[0].existe > 0) {
            console.warn('Intento de duplicar cita detectado (validación previa).');
            return res.status(400).send('Ya existe una cita para este paciente con ese médico en la misma fecha y hora.');
        }

        // ✅ Insertar la cita (la BD tiene índice único para protegernos)
        const sqlInsert = `
            INSERT INTO citas (idPaciente, idMedico, fechaHora, motivoConsulta, estado, tipoTurno) 
            VALUES (?, ?, ?, ?, 'En proceso', ?)
        `;
        db.query(
            sqlInsert,
            [sanitizedIdPaciente, sanitizedIdMedico, fechaHora, sanitizedMotivoConsulta, sanitizedTipoTurno],
            (error) => {
                if (error) {
                    if (error.code === 'ER_DUP_ENTRY') {
                        console.warn('Intento de duplicar cita detectado (índice único).');
                        return res.status(400).send('Ya existe una cita para este paciente con ese médico en la misma fecha y hora.');
                    }
                    console.error('Error al crear la cita en la base de datos:', error);
                    return res.status(500).send('Error al crear la cita.');
                }

                console.log('Cita creada exitosamente.');

                // Redirecciones según el rol
                if (req.session.user.role === 'paciente') {
                    return res.redirect('/turnos/mis-turnos');
                } else if (req.session.user.role === 'secretaria') {
                    return res.redirect('/secretaria/citas');
                } else {
                    return res.redirect('/');
                }
            }
        );
    });
};

// Editar una cita
exports.showEditForm = (req, res) => {
    const id = req.params.id;

    const sqlCita = 'SELECT * FROM citas WHERE idCita = ?';
    db.query(sqlCita, [id], (errorCita, resultsCita) => {
        if (errorCita) {
            console.error('Error al obtener la cita:', errorCita);
            return res.status(500).send("Error al obtener la cita");
        }
        // Formatear la fecha al formato compatible con datetime-local
        resultsCita[0].fechaHora = new Date(resultsCita[0].fechaHora).toISOString().slice(0, 16);

        const sqlMedicos = 'SELECT * FROM medicos';
        const sqlPacientes = 'SELECT * FROM pacientes';

        db.query(sqlMedicos, (errorMedicos, resultsMedicos) => {
            if (errorMedicos) {
                console.error('Error al obtener los médicos:', errorMedicos);
                return res.status(500).send("Error al obtener los médicos");
            }

            db.query(sqlPacientes, (errorPacientes, resultsPacientes) => {
                if (errorPacientes) {
                    console.error('Error al obtener los pacientes:', errorPacientes);
                    return res.status(500).send("Error al obtener los pacientes");
                }

                // Renderizar la vista con cita, médicos y pacientes
                res.render('editCita', {
                    cita: resultsCita[0],
                    medicos: resultsMedicos,
                    pacientes: resultsPacientes
                });
            });
        });
    });
};

exports.obtenerCitasJSON = (req, res) => {
    const medicoId = req.params.id;

    if (!medicoId) {
        console.error("❌ Falta idMedico");
        return res.status(400).json({ error: "idMedico es obligatorio" });
    }

    const { start, end } = req.query;

    let diasLaborales = [1, 2, 3, 4, 5];
    let feriados = [];

    try {
        if (req.query.diasLaboralesJSON) {
            diasLaborales = JSON.parse(req.query.diasLaboralesJSON);
        }
        if (req.query.feriadosJSON) {
            feriados = JSON.parse(req.query.feriadosJSON);
        }
    } catch (err) {
        console.error("Error parseando días laborales/feriados", err);
    }

    const sql = `
        SELECT 
            c.idCita,
            c.fechaHora,
            c.motivoConsulta,
            c.estado,
            c.tipoTurno,
            p.nombre AS nombrePaciente
        FROM citas c
        JOIN pacientes p ON c.idPaciente = p.idPaciente
        WHERE c.idMedico = ?
        AND c.fechaHora BETWEEN ?
        AND ?
        ORDER BY c.fechaHora ASC
    `;

    db.query(sql, [medicoId, start, end], (error, results) => {
        if (error) {
            console.error("❌ Error SQL citas-json:", error);
            return res.status(500).json({ error: "Error al obtener las citas" });
        }

        // ------------------------------
        // 🔴 1) CITAS OCUPADAS (ROJO)
        // ------------------------------
        const ocupados = results.map(cita => {
            const f = moment(cita.fechaHora);

            return {
                id: cita.idCita,
                title: `${cita.nombrePaciente} - ${cita.motivoConsulta}`,
                start: f.toISOString(),
                backgroundColor: "#dc3545",
                borderColor: "#dc3545",
                textColor: "white",
                extendedProps: {
                    estado: cita.estado,
                    tipoTurno: cita.tipoTurno,
                    paciente: cita.nombrePaciente,
                    motivo: cita.motivoConsulta
                }
            };
        });

        // -------------------------------------
        // 🟢 2) HORARIOS LIBRES REALES (VERDE)
        // -------------------------------------
        const libresPorDia = {};

        for (let d = moment(start); d.isSameOrBefore(end); d.add(1, "day")) {
            const fechaISO = d.format("YYYY-MM-DD");
            const delDia = results.filter(c => moment(c.fechaHora).format("YYYY-MM-DD") === fechaISO);

            const generados = generarHorariosLibres(
                fechaISO,
                delDia,
                { diasLaborales, feriados }
            );

            libresPorDia[fechaISO] = generados;
        }

        const libres = [];

        Object.entries(libresPorDia).forEach(([fecha, horas]) => {
            horas.forEach(h => {
                libres.push({
                    id: `disp-${h.startISO}`,
                    title: "Disponible",
                    start: h.startISO,
                    backgroundColor: "#28a745",
                    borderColor: "#28a745",
                    textColor: "white",
                    extendedProps: { estado: "Disponible" }
                });
            });
        });

        // ---------------------------
        // 📤 RESPUESTA FINAL
        // ---------------------------
        return res.json([...ocupados, ...libres]);
    });
};

// Editar una cita
exports.update = (req, res) => {
    const id = req.params.id;
    const { idMedico, idPaciente, fechaHora, motivoConsulta, estado } = req.body;

    // Verificar si la cita está completada
    const sqlVerificar = 'SELECT estado FROM citas WHERE idCita = ?';
    db.query(sqlVerificar, [id], (error, results) => {
        if (error) {
            console.error('Error al verificar el estado de la cita:', error);
            return res.status(500).send('Error al verificar el estado de la cita');
        }

        if (results[0].estado === 'Completado') {
            return res.status(403).send('No se puede editar una cita completada.');
        }

        // Actualizar la cita
        const sql = 'UPDATE citas SET idMedico = ?, idPaciente = ?, fechaHora = ?, motivoConsulta = ?, estado = ? WHERE idCita = ?';
        db.query(sql, [idMedico, idPaciente, fechaHora, motivoConsulta, estado, id], (error) => {
            if (error) {
                console.error('Error al actualizar la cita:', error);
                return res.status(500).send('Error al actualizar la cita');
            }
            res.redirect('/citas');
        });
    });
};
exports.actualizarEstadoCita = (req, res) => {
    const { idCita, nuevoEstado } = req.body;

    // Validación de datos
    if (!idCita || !nuevoEstado) {
        return res.status(400).send('Faltan datos requeridos.');
    }

    const sql = 'UPDATE citas SET estado = ? WHERE idCita = ?';

    db.query(sql, [nuevoEstado, idCita], (error, results) => {
        if (error) {
            console.error('Error al actualizar el estado de la cita:', error);
            return res.status(500).send('Error al actualizar el estado.');
        }

        console.log(`Estado de la cita ${idCita} actualizado a ${nuevoEstado}`);
        res.json({ mensaje: 'Estado actualizado correctamente' });
    });
};

exports.obtenerHorariosLibres = (req, res) => {
    const idMedico = req.params.id;
    const fecha = req.query.fecha; // YYYY-MM-DD

    if (!idMedico || !fecha) {
        return res.status(400).json({ error: "idMedico y fecha son obligatorios" });
    }

    const sql = `
        SELECT fechaHora 
        FROM horarios_libres
        WHERE idMedico = ? 
        AND DATE(fechaHora) = ?
        AND disponible = 1
        ORDER BY fechaHora ASC
    `;

    db.query(sql, [idMedico, fecha], (err, results) => {
        if (err) {
            console.error("Error al obtener horarios libres:", err);
            return res.status(500).json({ error: "Error al obtener horarios libres" });
        }

        // 👇 El frontend espera objetos con { start: "..." }
        const horarios = results.map(r => ({
            start: r.fechaHora
        }));

        return res.json(horarios);
    });
};



// Filtrar citas por estado (solo accesible por la secretaria)
exports.filterByState = (req, res) => {
    const { estado } = req.query; // Obtener el estado seleccionado desde la consulta

    let sql = `
        SELECT citas.idCita, pacientes.nombre AS nombrePaciente, medicos.nombre AS nombreMedico,
               citas.fechaHora, citas.motivoConsulta, citas.estado
        FROM citas
        JOIN pacientes ON citas.idPaciente = pacientes.idPaciente
        JOIN medicos ON citas.idMedico = medicos.idMedico
    `;

    // Aplicar el filtro si se selecciona un estado
    if (estado) {
        sql += ` WHERE citas.estado = ?`;
    }

    const params = estado ? [estado] : [];

    db.query(sql, params, (error, results) => {
        if (error) {
            console.error('Error al filtrar citas por estado:', error);
            return res.status(500).send('Error al filtrar citas');
        }

        // Renderizar la vista con los resultados filtrados
        res.render('citas', {
            citas: results,
            estadoSeleccionado: estado // Para resaltar el filtro seleccionado
        });
    });
};

// Eliminar un turno completado
exports.deleteCompleted = (req, res) => {
    const id = req.params.id;
    const sql = 'DELETE FROM citas WHERE idCita = ? AND estado = "Completado"';

    db.query(sql, [id], (error, results) => {
        if (error) {
            console.error('Error al eliminar el turno completado:', error);
            res.status(500).send("Error al eliminar el turno completado");
        } else {
            res.redirect('/turnos/mis-turnos');
        }
    });
};

exports.iniciarConsulta = (req, res) => {
    const idCita = req.params.idCita;

    // 1) Obtener datos de la cita
    const sqlSelect = `
        SELECT idPaciente, idMedico, fechaHora, motivoConsulta
        FROM citas
        WHERE idCita = ?
    `;

    db.query(sqlSelect, [idCita], (err, results) => {
        if (err) {
            console.error("Error al obtener datos de la cita:", err);
            return res.status(500).send("Error al obtener datos de la cita.");
        }

        if (results.length === 0) {
            return res.status(404).send("Cita no encontrada.");
        }

        const { idPaciente, idMedico, fechaHora, motivoConsulta } = results[0];

        // 2) Registrar visita en historial_visitas
        const sqlInsert = `
            INSERT INTO historial_visitas (idPaciente, idMedico, fechaVisita, motivo, notas)
            VALUES (?, ?, ?, ?, NULL)
        `;

        db.query(sqlInsert, [idPaciente, idMedico, fechaHora, motivoConsulta], (err2) => {
            if (err2) {
                console.error("Error al registrar visita:", err2);
                return res.status(500).send("Error al registrar visita.");
            }

            // 3) Actualizar estado de la cita
            const sqlUpdate = `
                UPDATE citas SET estado = 'Atendido' WHERE idCita = ?
            `;

            db.query(sqlUpdate, [idCita], (err3) => {
                if (err3) {
                    console.error("Error al actualizar estado:", err3);
                    return res.status(500).send("Error al actualizar estado.");
                }

                // 4) Redirigir a historia clínica
                res.redirect(`/historia-clinica/${idCita}`);
            });
        });
    });
};

// funcion para la bsuqueda de paciente

exports.autocompletePacientesParaCita = (req, res) => {
    const term = req.query.term;
    const sql = `SELECT idPaciente, nombre FROM pacientes WHERE nombre LIKE ? LIMIT 10`;
    db.query(sql, [`%${term}%`], (error, results) => {
        if (error) {
            console.error('Error en la búsqueda de pacientes:', error);
            return res.status(500).send('Error en la búsqueda');
        }
        res.json(results);
    });
};

// 🔴 Eliminar una cita (solo secretaria)
exports.delete = (req, res) => {
    const id = req.params.id;

    const sql = 'DELETE FROM citas WHERE idCita = ?';

    db.query(sql, [id], (error) => {
        if (error) {
            console.error('Error al eliminar la cita:', error);
            return res.status(500).send("Error al eliminar la cita");
        }

        // Redirigir a la lista de citas de la secretaria
        res.redirect('/secretaria/citas');
    });
};



