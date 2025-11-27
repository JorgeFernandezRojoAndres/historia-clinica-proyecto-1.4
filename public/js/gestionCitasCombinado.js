document.addEventListener('DOMContentLoaded', function () {
  const especialidadSelector = document.getElementById('especialidadSelector');
  const medicoSelector = document.getElementById('idMedico');
  const verAgendaButton = document.getElementById('verAgendaButton');
  const buscarPacienteInput = document.getElementById('buscarPaciente');
  const listaResultados = document.getElementById('listaResultados');
  const especialidadMedicoInput = document.getElementById('especialidadMedico');
  const idPacienteInput = document.getElementById('idPaciente');
  const fechaHoraInput = document.getElementById('fechaHora');
  const diaTurnoInput = document.getElementById('diaTurno');

  const userRole = window.userRole || null;

  if (fechaHoraInput && userRole === 'paciente') {
    fechaHoraInput.addEventListener('keydown', e => e.preventDefault());
    fechaHoraInput.addEventListener('input', e => e.preventDefault());
  }

  let medicos = [];
  try {
    medicos = JSON.parse(document.getElementById('medicosData').textContent);
  } catch (error) {
    console.error('Error al cargar los datos de médicos:', error);
    return;
  }

  if (medicoSelector) {
    if (verAgendaButton) {
      configurarBotonAgenda('idMedico', 'verAgendaButton', 'especialidadMedico');
    }
  }

  if (especialidadSelector && medicoSelector) {
    especialidadSelector.addEventListener('change', function () {
      const especialidadSeleccionada = this.value;
      medicoSelector.innerHTML = '<option value="">-- Selecciona un médico --</option>';

      try {
        medicos.forEach(medico => {
          if (medico.especialidad === especialidadSeleccionada) {
            const option = document.createElement('option');
            option.value = medico.idMedico;
            option.textContent = medico.nombre;
            option.dataset.especialidad = medico.especialidad;
            medicoSelector.appendChild(option);
          }
        });

        if (especialidadMedicoInput) especialidadMedicoInput.value = '';
      } catch (error) {
        console.error('Error al filtrar médicos por especialidad:', error);
      }
    });
  }

  if (medicoSelector && especialidadMedicoInput) {
    medicoSelector.addEventListener('change', function () {
      const selected = medicoSelector.options[medicoSelector.selectedIndex];
      if (selected && selected.dataset.especialidad) {
        especialidadMedicoInput.value = selected.dataset.especialidad;
      }
    });
  }

  if (buscarPacienteInput && listaResultados) {
    buscarPacienteInput.addEventListener('input', async function () {
      const query = buscarPacienteInput.value.trim();

      if (query.length > 0) {
        try {
          const response = await fetch(`/citas/buscar-paciente?term=${query}`);
          if (response.ok) {
            const pacientes = await response.json();
            mostrarResultados(pacientes);
          }
        } catch (error) {
          console.error('Error al buscar pacientes:', error);
        }
      } else {
        listaResultados.style.display = 'none';
      }
    });
  }

  if (diaTurnoInput) {
    flatpickr(diaTurnoInput, {
      dateFormat: "Y-m-d",
      altFormat: "d/m/Y",
      altInput: true,
      minDate: "today",
      locale: "es",
      allowInput: false,
      disableMobile: true
    });
  }

  if (diaTurnoInput && medicoSelector) {
    diaTurnoInput.addEventListener("change", async () => {

      const fecha = diaTurnoInput.value;
      const idMedico = medicoSelector.value;

      if (!fecha || !idMedico) return;

      const resp = await fetch(`/citas/validar-fecha?idMedico=${idMedico}&fecha=${fecha}`);
      const data = await resp.json();

      if (!data.disponible) {
        Swal.fire({
          icon: "error",
          title: "Fecha no disponible",
          text: data.motivo || "No puedes seleccionar esta fecha"
        });

        diaTurnoInput.value = "";
        fechaHoraInput.value = "";
        return;
      }

      const respH = await fetch(`/horarios/obtener-horarios-libres/${idMedico}?fecha=${fecha}`);

      const horarios = await respH.json();

      if (!Array.isArray(horarios) || horarios.length === 0) {
        Swal.fire({
          icon: "warning",
          title: "Sin horarios",
          text: "No hay horarios disponibles en esta fecha"
        });
        fechaHoraInput.value = "";
        return;
      }

      Swal.fire({
        title: "Selecciona un horario",
        input: "select",
        inputOptions: horarios.reduce((acc, h) => {
          const valor = h.start;
          const legible = valor.replace("T", " ").slice(0, 16);
          acc[valor] = legible;
          return acc;
        }, {}),

        inputPlaceholder: "Seleccionar…",
        showCancelButton: true,
        confirmButtonText: "Aceptar",
      }).then(result => {
        if (result.isConfirmed) {
          fechaHoraInput.value = result.value;
        } else {
          fechaHoraInput.value = "";
        }
      });
    });
  }

  function mostrarResultados(pacientes) {
    listaResultados.innerHTML = '';

    if (pacientes.length > 0) {
      listaResultados.style.display = 'block';
      pacientes.forEach(paciente => {
        const li = document.createElement('li');
        li.textContent = `${paciente.nombre} (ID: ${paciente.idPaciente})`;
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => seleccionarPaciente(paciente));
        listaResultados.appendChild(li);
      });
    } else {
      listaResultados.style.display = 'none';
    }
  }

  function seleccionarPaciente(paciente) {
    if (buscarPacienteInput) buscarPacienteInput.value = paciente.nombre;
    if (idPacienteInput) idPacienteInput.value = paciente.idPaciente;
    listaResultados.style.display = 'none';
  }

  document.addEventListener('click', function (e) {
    if (
      buscarPacienteInput &&
      listaResultados &&
      !buscarPacienteInput.contains(e.target) &&
      !listaResultados.contains(e.target)
    ) {
      listaResultados.style.display = 'none';
    }
  });

  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin) return;

    const { tipo, fechaHora } = event.data;
    if (tipo === 'seleccionarHorario' && fechaHora) {
      if (fechaHoraInput) {
        fechaHoraInput.value = fechaHora;
      }
    }
  });
});
