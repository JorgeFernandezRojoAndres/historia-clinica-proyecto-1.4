const db = require('../config/database');
const express = require('express');
const router = express.Router();
const medicosController = require('../app/controllers/medicosController');
const authMiddleware = require('../middleware/roleMiddleware');
const citasController = require('../app/controllers/citasController');


// ------------------------------------------------------
// NUEVA RUTA → Citas JSON para FullCalendar
// ------------------------------------------------------
router.get('/:id/citas-json',
    authMiddleware.isAuthenticated,
    (req, res) => {
        citasController.obtenerCitasJSON(req, res);
    }
);

// ------------------------------------------------------
// AGENDA DEL DÍA
// ------------------------------------------------------
router.get('/:id/agenda-dia', authMiddleware.isAuthenticated, (req, res) => {
    medicosController.verAgendaDelDia(req, res);
});

// ------------------------------------------------------
// AGENDA DEL MÉDICO LOGUEADO
// ------------------------------------------------------
router.get('/agenda',
    authMiddleware.isAuthenticated,
    authMiddleware.isMedico,
    (req, res) => {
        const medicoId = req.session.user?.id;
        if (!medicoId) {
            return res.status(400).send("No se pudo identificar al médico en la sesión.");
        }
        medicosController.verAgenda(req, res, medicoId);
    }
);

// ------------------------------------------------------
// AGENDA DE UN MÉDICO ESPECÍFICO (secretaria/admin/paciente)
// ------------------------------------------------------
router.get('/:id/agenda',
    authMiddleware.isAuthenticated,
    (req, res) => {
        const medicoId = req.params.id;
        medicosController.verAgenda(req, res, medicoId);
    }
);

// ------------------------------------------------------
// PERFIL DEL MÉDICO
// ------------------------------------------------------
router.get('/perfil',
    authMiddleware.isAuthenticated,
    authMiddleware.isMedico,
    (req, res) => {
        const user = req.session.user;

        if (user.password_change_required) {
            return res.render('CDC', { user });
        }

        const sqlCitas = `
            SELECT citas.idCita, pacientes.nombre AS nombrePaciente, citas.fechaHora, citas.motivoConsulta
            FROM citas
            JOIN pacientes ON citas.idPaciente = pacientes.idPaciente
            WHERE citas.idMedico = ? AND DATE(citas.fechaHora) = CURDATE()
        `;

        const sqlPacientes = 'SELECT * FROM pacientes';

        db.query(sqlCitas, [user.id], (error, citas) => {
            if (error) {
                console.error('Error al obtener las citas:', error);
                return res.status(500).send('Error al cargar el escritorio del médico');
            }

            db.query(sqlPacientes, (error, pacientes) => {
                if (error) {
                    console.error('Error al obtener los pacientes:', error);
                    return res.status(500).send('Error al cargar la lista de pacientes');
                }

                res.render('escritorioMedico', {
                    user: user,
                    citas: citas,
                    pacientes: pacientes || []
                });
            });
        });
    }
);

// ------------------------------------------------------
// FUNCIONALIDADES MÉDICO: evolución, hábitos, etc.
// ------------------------------------------------------
router.get('/registrar-evolucion',
    authMiddleware.isAuthenticated,
    authMiddleware.isMedico,
    (req, res) => {
        res.render('registrarEvolucion', { idPaciente: req.query.idPaciente, paciente: req.query.paciente });
    }
);

router.post('/registrar-evolucion',
    authMiddleware.isAuthenticated,
    authMiddleware.isMedico,
    medicosController.registrarEvolucion
);

router.get('/agregar-diagnostico',
    authMiddleware.isAuthenticated,
    authMiddleware.isMedico,
    (req, res) => {
        res.render('agregarDiagnostico', { idPaciente: req.query.idPaciente, paciente: req.query.paciente });
    }
);

router.post('/agregar-diagnostico',
    authMiddleware.isAuthenticated,
    authMiddleware.isMedico,
    medicosController.agregarDiagnostico
);

router.get('/agregar-alergias',
    authMiddleware.isAuthenticated,
    authMiddleware.isMedico,
    (req, res) => {
        res.render('agregarAlergias', { idPaciente: req.query.idPaciente, paciente: req.query.paciente });
    }
);

router.post('/agregar-alergias',
    authMiddleware.isAuthenticated,
    authMiddleware.isMedico,
    medicosController.agregarAlergias
);

router.get('/registrar-antecedentes',
    authMiddleware.isAuthenticated,
    authMiddleware.isMedico,
    (req, res) => {
        res.render('registrarAntecedentes', { idPaciente: req.query.idPaciente, paciente: req.query.paciente });
    }
);

router.post('/registrar-antecedentes',
    authMiddleware.isAuthenticated,
    authMiddleware.isMedico,
    medicosController.registrarAntecedentes
);

router.get('/registrar-habitos',
    authMiddleware.isAuthenticated,
    authMiddleware.isMedico,
    (req, res) => {
        res.render('registrarHabitos', { idPaciente: req.query.idPaciente, paciente: req.query.paciente });
    }
);

router.post('/registrar-habitos',
    authMiddleware.isAuthenticated,
    authMiddleware.isMedico,
    medicosController.registrarHabitos
);

router.get('/medicamentos',
    authMiddleware.isAuthenticated,
    authMiddleware.isMedico,
    (req, res) => {
        res.render('agregarMedicamento', { idPaciente: req.query.idPaciente, paciente: req.query.paciente });
    }
);

router.post('/medicamentos',
    authMiddleware.isAuthenticated,
    authMiddleware.isMedico,
    medicosController.medicamentos
);

// ------------------------------------------------------
// TEMPLATE DE NOTA
// ------------------------------------------------------
router.get('/template-nota',
    authMiddleware.isAuthenticated,
    authMiddleware.isMedico,
    (req, res) => {
        res.render('templateNota', { idPaciente: req.query.idPaciente, paciente: req.query.paciente });
    }
);

router.post('/template-nota',
    authMiddleware.isAuthenticated,
    authMiddleware.isMedico,
    medicosController.templateNota
);

// ------------------------------------------------------
// ADMINISTRAR MÉDICOS
// ------------------------------------------------------
router.post('/:id',
    authMiddleware.isAuthenticated,
    authMiddleware.isAdmin,
    medicosController.update
);

router.get('/',
    authMiddleware.isAuthenticated,
    authMiddleware.isAdmin,
    medicosController.listAll
);

// ------------------------------------------------------
// ESCRITORIO
// ------------------------------------------------------
router.get('/escritorio',
    authMiddleware.isAuthenticated,
    authMiddleware.isMedico,
    (req, res) => {
        res.render('escritorioMedicos', { user: req.session.user });
    }
);

// ------------------------------------------------------
// CAMBIO DE CONTRASEÑA
// ------------------------------------------------------
router.post('/cambiar-contrasena',
    authMiddleware.isAuthenticated,
    medicosController.changePassword
);

router.get('/cambiar-contrasena',
    authMiddleware.isAuthenticated,
    (req, res) => {
        res.render('CDC');
    }
);

// ------------------------------------------------------
// BUSCAR MÉDICOS (secretaria)
// ------------------------------------------------------
router.get('/search',
    authMiddleware.isAuthenticated,
    authMiddleware.isSecretaria,
    medicosController.search
);

// ------------------------------------------------------
// HISTORIAL DE PACIENTE
// ------------------------------------------------------
router.get('/historial/:idPaciente',
    authMiddleware.isAuthenticated,
    (req, res) => {
        medicosController.verHistorialPaciente(req, res);
    }
);

// ------------------------------------------------------
// HISTORIAL GENERAL DEL MÉDICO
// ------------------------------------------------------
router.get('/historial',
    authMiddleware.isAuthenticated,
    (req, res) => {
        const sql = `
            SELECT 
                citas.idCita, 
                pacientes.nombre AS nombrePaciente, 
                medicos.nombre AS nombreMedico,
                DATE_FORMAT(citas.fechaHora, '%d/%m/%Y %H:%i') AS fechaHora,
                citas.motivoConsulta, 
                citas.estado
            FROM citas
            JOIN pacientes ON citas.idPaciente = pacientes.idPaciente
            JOIN medicos ON citas.idMedico = medicos.idMedico
            WHERE citas.idMedico = ?
            ORDER BY citas.fechaHora DESC
        `;

        db.query(sql, [req.session.user.id], (error, results) => {
            if (error) {
                console.error('Error al obtener el historial:', error);
                return res.status(500).send('Error al obtener el historial');
            }

            res.render('historialPaciente', {
                historial: results,
                nombreMedico: req.session.user.nombre
            });
        });
    }
);


// ------------------------------------------------------
// AGENDA EXCLUSIVA PARA PACIENTES (vista limpia con FullCalendar)
// ------------------------------------------------------
router.get('/:id/agenda-paciente',
    authMiddleware.isAuthenticated,
    authMiddleware.isPaciente,
    (req, res) => {
        const medicoId = req.params.id;
        res.render('agenda_paciente', { medicoId });
    }
);

// ------------------------------------------------------
// INICIAR CONSULTA
// ------------------------------------------------------
router.post('/iniciar/:idCita', citasController.iniciarConsulta);
router.get('/iniciar-consulta/:idCita', citasController.cargarConsulta);

module.exports = router;
