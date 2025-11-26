const { Sequelize, DataTypes } = require('sequelize'); 
const connection = require('./database');

const sequelize = new Sequelize(connection);

const Paciente = sequelize.define('Paciente', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fechaNacimiento: {
    type: DataTypes.DATE,
    allowNull: false
  },
  dni: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  direccion: {
    type: DataTypes.STRING,
    allowNull: false
  },
  telefono: {
    type: DataTypes.STRING,
    allowNull: false
  },
  estado: {
    type: DataTypes.STRING,
    defaultValue: 'Pendiente', // Estado inicial como "Pendiente"
    allowNull: false
  },
  // Se añade el campo fechaRegistro para almacenar la fecha de registro
  fechaRegistro: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW, // Asigna la fecha y hora actual por defecto
    allowNull: false
  }
});

module.exports = Paciente;
