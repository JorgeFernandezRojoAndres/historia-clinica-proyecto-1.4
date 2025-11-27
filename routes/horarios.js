const express = require('express');
const router = express.Router();
const horariosController = require('../app/controllers/horariosController');
const { isAuthenticated } = require('../middleware/roleMiddleware');

// validar fecha
router.get('/validar-fecha', isAuthenticated, horariosController.validarFechaDisponible);

// horarios libres
router.get('/obtener-horarios-libres/:id', horariosController.obtenerHorariosLibres);

module.exports = router;
