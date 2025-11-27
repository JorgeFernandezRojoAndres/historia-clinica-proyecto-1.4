const express = require('express');
const router = express.Router();
const citasController = require('../app/controllers/citasController');
const { isAuthenticated, isSecretaria, isPacienteOrSecretaria } = require('../middleware/roleMiddleware');

// Listar todas las citas
router.get('/', isAuthenticated, citasController.listAll);

// Mostrar el formulario para crear una nueva cita
router.get('/new', isAuthenticated, isPacienteOrSecretaria, citasController.showNewForm);

// Crear una nueva cita
router.post('/new', isAuthenticated, isPacienteOrSecretaria, citasController.createCita);

// Mostrar el formulario para editar una cita
router.get('/edit/:id', isAuthenticated, citasController.showEditForm);

// Actualizar una cita
router.post('/update/:id', isAuthenticated, citasController.update);

// 🔥 VALIDAR FECHA DISPONIBLE
router.get('/validar-fecha', isAuthenticated, citasController.validarFechaDisponible);

// Filtrar citas (solo secretaria)
router.get('/filter', isAuthenticated, isSecretaria, citasController.filterByState);

// Eliminar turno completado
router.get('/delete-completed/:id', isAuthenticated, isPacienteOrSecretaria, citasController.deleteCompleted);

// Eliminar cita normal
router.get('/delete/:id', isAuthenticated, isPacienteOrSecretaria, citasController.delete);

// Contar citas en proceso
router.get('/count-en-proceso', isAuthenticated, isSecretaria, citasController.countEnProceso);

// Autocompletar pacientes
router.get('/buscar-paciente', isAuthenticated, isPacienteOrSecretaria, citasController.autocompletePacientesParaCita);
// Horarios libres del médico por fecha
router.get('/obtener-horarios-libres/:idMedico', citasController.obtenerHorariosLibres);

module.exports = router;
