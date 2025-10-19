// frontend/app.js
const API_URL = "http://localhost:3000"; // Cambia esto al backend desplegado
const stripe = Stripe("pk_test_TU_CLAVE_PUBLICA_DE_STRIPE"); // tu clave pública de Stripe
let jwtToken = null;

// --- UI elements ---
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const payForm = document.getElementById("payForm");
const statusBox = document.getElementById("status");

// Mostrar mensajes
function showStatus(msg, isError = false) {
  statusBox.innerText = msg;
  statusBox.style.color = isError ? "red" : "green";
}

// --- Registro ---
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = e.target.name.value;
    const email = e.target.email.value;
    const password = e.target.password.value;

    const res = await fetch(`${API_URL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();

    if (data.ok) showStatus("Usuario registrado con éxito");
    else showStatus(data.error || "Error al registrar", true);
  });
}

// --- Login ---
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;

    const res = await fetch(`${API_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (data.token) {
      jwtToken = data.token;
      showStatus("Inicio de sesión correcto. Bienvenido, " + data.user.name);
      document.getElementById("paymentSection").style.display = "block";
    } else {
      showStatus(data.error || "Error al iniciar sesión", true);
    }
  });
}

// --- Pago con Stripe ---
if (payForm) {
  payForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const amount = parseFloat(e.target.amount.value) * 100; // en céntimos

    const res = await fetch(`${API_URL}/api/create-payment-intent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + jwtToken,
      },
      body: JSON.stringify({ amount }),
    });

    const data = await res.json();
    if (!data.clientSecret) {
      showStatus("Error al crear el pago", true);
      return;
    }

    const { error, paymentIntent } = await stripe.confirmCardPayment(
      data.clientSecret,
      {
        payment_method: {
          card: { token: "tok_visa" }, // Tarjeta de prueba
        },
      }
    );

    if (error) showStatus("Error: " + error.message, true);
    else showStatus("✅ Pago completado correctamente por " + amount / 100 + "€");
  });
}
