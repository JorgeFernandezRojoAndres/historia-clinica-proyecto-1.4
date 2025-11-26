// app/controllers/pacientesController.js
const db = require('../../config/database');

exports.listAll = (req, res) => {
    const sql = 'SELECT idPaciente, nombre, fechaNacimiento, dni, direccion, telefono FROM pacientes';
    db.query(sql, (error, results) => {
        if (error) {
            console.error('Error al obtener los pacientes:', error);
            return res.status(500).send('Error al obtener los pacientes');
        }

        results.forEach(paciente => {
            paciente.fechaNacimiento = new Date(paciente.fechaNacimiento).toLocaleDateString('es-ES', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
        });

        // Verificar si la solicitud es AJAX
        if (req.xhr) {
            return res.json(results); // Devolver JSON si es AJAX
        }

        res.render('pacientes', { pacientes: results }); // Renderizar la vista si es navegación normal
    });
};


exports.showRegisterForm = (req, res) => {
    // Obtener el idClinica desde la sesión
    const idClinica = req.session.idClinica;

    // Verificar si se ha seleccionado una clínica
    if (!idClinica) {
        console.log('No se ha seleccionado una clínica, redirigiendo a la selección de clínica.');
        return res.redirect('/seleccion-clinica'); // Redirige a la selección de clínica si no hay una clínica seleccionada
    }

    // Consulta para obtener médicos de la clínica seleccionada
    const query = `
        SELECT m.*
        FROM medicos AS m
        JOIN medicos_clinicas AS mc ON m.idMedico = mc.idMedico
        WHERE mc.idClinica = ?;
    `;

    db.query(query, [idClinica], (error, medicos) => {
        if (error) {
            console.error('Error al obtener los médicos:', error);
            return res.status(500).send('Error al obtener los médicos');
        }

        // Verificar si se encontraron médicos
        if (medicos.length === 0) {
            console.log('No se encontraron médicos para la clínica seleccionada.');
            return res.status(404).send('No se encontraron médicos para la clínica seleccionada.');
        }

        // Renderizar el formulario de nuevo paciente con la lista de médicos de la clínica seleccionada
        res.render('new_pacientes', { medicos });
    });
};



exports.create = (req, res) => {
    const { nombre, fechaNacimiento, dni, direccion, telefono } = req.body;
    console.log('Creando nuevo paciente:', { nombre, fechaNacimiento, dni, direccion, telefono });

    const sql = 'INSERT INTO pacientes (nombre, fechaNacimiento, dni, direccion, telefono, estado) VALUES (?, ?, ?, ?, ?, "Pendiente")';

    db.query(sql, [nombre, fechaNacimiento, dni, direccion, telefono], (error, results) => {
        if (error) {
            console.error('Error al crear el paciente:', error);
            return res.status(500).send("Error al crear el paciente");
        }

        console.log('Paciente creado exitosamente');

        // Redirige dependiendo de si el usuario está autenticado y su rol
        if (req.session.user && req.session.user.role === 'secretaria') {
            return res.redirect('/register/paciente'); // Redirige a la ruta para secretarias
        } else {
            // Agregamos '/paciente' al inicio
            return res.redirect('/paciente/registro-pendiente');
        }
    });
};




exports.showEditForm = (req, res) => {
    const id = req.params.id;
    const sql = 'SELECT * FROM pacientes WHERE idPaciente = ?';

    db.query(sql, [id], (error, results) => {
        if (error) {
            console.error('Error al obtener el paciente:', error);
            return res.status(500).send('Error al obtener el paciente');
        }

        if (results.length === 0) {
            return res.status(404).send('Paciente no encontrado');
        }

        // Formatear la fecha de nacimiento en formato ISO para el campo 'date'
        results[0].fechaNacimiento = new Date(results[0].fechaNacimiento).toISOString().split('T')[0];

        res.render('editPaciente', { paciente: results[0] });
    });
};


exports.update = (req, res) => {
    const { nombre, fechaNacimiento, dni, direccion, telefono } = req.body;
    const id = req.params.id;

    const sql = 'UPDATE pacientes SET nombre = ?, fechaNacimiento = ?, dni = ?, direccion = ?, telefono = ? WHERE idPaciente = ?';
    db.query(sql, [nombre, fechaNacimiento, dni, direccion, telefono, id], (error, results) => {
        if (error) {
            console.error('Error al actualizar el paciente:', error);
            return res.status(500).send("Error al actualizar el paciente");
        }

        // Redirigir según el rol del usuario
        if (req.session.user.role === 'secretaria') {
            res.redirect('/secretaria/pacientes'); // Redirige a la lista de pacientes si es secretaria
        } else if (req.session.user.role === 'paciente') {
            res.redirect('/paciente/mi-perfil'); // Redirige al perfil del paciente
        } else {
            res.redirect('/');
        }
    });
};



exports.delete = (req, res) => {
    console.log('Intentando eliminar paciente con ID:', req.params.id);
    const id = req.params.id;
    const sql = 'DELETE FROM pacientes WHERE idPaciente = ?';

    db.query(sql, [id], (error, results) => {
        if (error) {
            console.error('Error al eliminar el paciente:', error);
            return res.status(500).send('Error al eliminar el paciente');
        }
        res.redirect('/secretaria/pacientes');
    });
};




exports.buscarPaciente = (req, res) => {
    const dni = req.params.dni;
    const sql = `SELECT p.nombre, hc.detalles 
                 FROM pacientes p 
                 LEFT JOIN historias_clinicas hc 
                 ON p.idPaciente = hc.idPaciente 
                 WHERE p.dni = ?`;

    db.query(sql, [dni], (error, results) => {
        if (error) {
            return res.status(500).json({ success: false, message: 'Error al buscar paciente' });
        }
        if (results.length > 0) {
            const paciente = results[0];
            res.json({
                success: true,
                nombre: paciente.nombre,
                detalles: paciente.detalles || 'Sin historial clínico'
            });
        } else {
            res.json({ success: false, message: 'Paciente no encontrado' });
        }
    });
};

exports.search = (req, res) => {
    const query = req.query.query || '';
    console.log("Ejecutando búsqueda de pacientes con query:", query);

    if (query.trim().length === 0) {
        return res.status(400).json({ message: 'La búsqueda no puede estar vacía.' });
    }

    const searchTerm = `%${query}%`;
    const sql = 'SELECT * FROM pacientes WHERE nombre LIKE ?';

    db.query(sql, [searchTerm], (error, results) => {
        if (error) {
            console.error('Error al buscar pacientes:', error);
            return res.status(500).send('Error al buscar pacientes');
        }

        console.log("Resultados de búsqueda:", results);

        if (results.length > 0) {
            res.json(results); // Devuelve resultados como JSON
        } else {
            res.json({ message: 'No se encontraron pacientes.' });
        }
    });
};

exports.showProfile = (req, res) => {
    const idPaciente = req.session.user.id; // Obtiene el ID del paciente desde la sesión

    // Consulta para obtener la información del paciente
    const sql = 'SELECT * FROM pacientes WHERE idPaciente = ?';
    db.query(sql, [idPaciente], (error, results) => {
        if (error) {
            console.error('Error al buscar paciente:', error);
            return res.status(500).send('Error al buscar paciente');
        }

        if (results.length > 0) {
            const paciente = results[0];

            // Verificar si el estado del paciente es "Pendiente"
            console.log('Estado del paciente:', paciente.estado); // Log para verificar el estado

            if (paciente.estado === 'Pendiente') {
                // Agregamos '/paciente' al inicio
                return res.redirect('/paciente/espera-aprobacion');
            }

            res.render('perfilPaciente', { paciente }); // Si el paciente está aprobado, mostrar su perfil
        } else {
            res.status(404).send('Paciente no encontrado');
        }
    });
};


// Mostrar pacientes pendientes
exports.showPendingPatients = (req, res) => {
    const sql = 'SELECT * FROM pacientes WHERE estado = "Pendiente"';
    db.query(sql, (error, results) => {
        if (error) {
            console.error('Error al obtener pacientes pendientes:', error);
            return res.status(500).send('Error al obtener pacientes pendientes');
        }
        res.render('adminPacientesPendientes', { pacientesPendientes: results });
    });
};

// Confirmar paciente 
exports.confirmPatient = (req, res) => {
    const idPaciente = req.params.idPaciente;

    // ✔ Activar paciente
    // ✔ Registrar fecha de alta (hoy)
    const sql = 'UPDATE pacientes SET estado = "Activo", fechaAlta = CURDATE() WHERE idPaciente = ?';

    db.query(sql, [idPaciente], (error, results) => {
        if (error) {
            console.error('Error al confirmar paciente:', error);
            return res.status(500).send('Error al confirmar paciente');
        }

        // Redirige a la lista de pacientes pendientes
        res.redirect('/admin/pacientes-pendientes');
    });
};



exports.rejectPatient = (req, res) => {
    const idPaciente = req.params.idPaciente; // 👈 coincide con la ruta
    const sql = 'DELETE FROM pacientes WHERE idPaciente = ?';
    db.query(sql, [idPaciente], (error, results) => {
        if (error) {
            console.error('Error al rechazar paciente:', error);
            return res.status(500).send('Error al rechazar paciente');
        }
        res.redirect('/admin/pacientes-pendientes');
    });
};

exports.history = (req, res) => {
    const idPaciente = req.session.user.id; // ID del paciente logueado

    const sql = `
        SELECT 
            c.idCita,
            m.nombre AS nombreMedico,
            DATE_FORMAT(c.fechaHora, '%d/%m/%Y %H:%i') AS fechaHora,
            c.motivoConsulta,
            c.estado
        FROM citas c
        LEFT JOIN medicos m ON c.idMedico = m.idMedico
        WHERE c.idPaciente = ?
        ORDER BY c.fechaHora DESC
    `;

    db.query(sql, [idPaciente], (error, results) => {
        if (error) {
            console.error('Error al obtener historial:', error);
            return res.status(500).send('Error al obtener historial');
        }

        res.render('historialPaciente', {
            historial: results,
            nombrePaciente: req.session.user.nombre
        });
    });
};
exports.verMisVisitas = (req, res) => {
    const idPaciente = req.session.user.id;

    const sql = `
        SELECT 
            c.fechaHora AS fechaVisita,
            m.nombre AS nombreMedico,
            c.motivoConsulta AS motivo,
            c.estado,
            '-' AS notas
        FROM citas c
        INNER JOIN medicos m ON c.idMedico = m.idMedico
        WHERE c.idPaciente = ?
          AND c.estado = 'Completado'
        ORDER BY c.fechaHora DESC
    `;

    db.query(sql, [idPaciente], (error, results) => {
        if (error) {
            console.error("Error al obtener visitas:", error);
            return res.status(500).send("Error al obtener visitas");
        }

        res.render("misVisitas", { visitas: results });
    });
};
