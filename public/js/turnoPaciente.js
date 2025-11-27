document.addEventListener("DOMContentLoaded", () => {
    const diaInput = document.getElementById("diaTurno");
    const medicoSelect = document.getElementById("idMedico");
    const fechaHoraInput = document.getElementById("fechaHora");

    if (!diaInput || !medicoSelect || !fechaHoraInput) return;

    diaInput.addEventListener("change", () => {
        const fecha = diaInput.value;
        const medicoId = medicoSelect.value;

        if (!fecha || !medicoId) return;

        fetch(`/medicos/${medicoId}/citas-json?start=${fecha}T00:00:00Z&end=${fecha}T23:59:59Z&role=paciente`)
            .then(r => r.json())
            .then(citas => {
                const libres = citas
                    .filter(c => c.extendedProps?.estado === "Disponible")
                    .map(ev => {
                        const f = new Date(ev.start);
                        const hh = String(f.getUTCHours()).padStart(2, "0");
                        const mm = String(f.getUTCMinutes()).padStart(2, "0");
                        return `${hh}:${mm}`;
                    });

                if (libres.length === 0) {
                    Swal.fire({
                        icon: "warning",
                        title: "Sin horarios disponibles",
                        text: "No queda ningún horario libre en este día."
                    });
                    return;
                }

                let optionsHtml = libres
                    .map(h => `<option value="${h}">${h}</option>`)
                    .join("");

                Swal.fire({
                    title: "Elegí un horario disponible",
                    html: `
                        <select id="swal-horario" class="swal2-input">
                            ${optionsHtml}
                        </select>
                    `,
                    confirmButtonText: "Elegir",
                    showCancelButton: true,
                    preConfirm: () => {
                        const val = document.getElementById("swal-horario").value;
                        return val;
                    }
                }).then(result => {
                    if (!result.isConfirmed) return;

                    const elegido = result.value;
                    if (!elegido || !libres.includes(elegido)) return;

                    const [y, m, d] = fecha.split("-");
                    const finalValue = `${y}-${m}-${d}T${elegido}`;

                    fechaHoraInput.value = finalValue;
                });
            })
            .catch(err => {
                Swal.fire({
                    icon: "error",
                    title: "Error",
                    text: "No se pudieron obtener los horarios disponibles."
                });
            });
    });
});
