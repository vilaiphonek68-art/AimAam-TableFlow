let cart = [];
let currentCategory = "All";
let customerId = null;
let trackingTimer = null;
let isSubmitting = false;

const foodGrid = document.getElementById("foodGrid");
const categories = document.getElementById("categories");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");

const customerOrders = document.getElementById("customerOrders");
const trackingMessage = document.getElementById("trackingMessage");

// Escape text before displaying database content
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// Create or restore customer login session
async function ensureCustomerSession() {
    const client = window.tableFlowSupabase;

    const { data: { session }, error: sessionError } =
        await client.auth.getSession();

    if (sessionError) throw sessionError;

    if (session) return session.user;

    const { data, error } = await client.auth.signInAnonymously();

    if (error) throw error;

    if (!data.user) {
        throw new Error("Customer session could not be created.");
    }

    return data.user;
}

// Display food categories
function renderCategories() {
    const allCategories = [
        "All",
        ...new Set(FOOD_MENU.map(food => food.category))
    ];

    categories.innerHTML = allCategories.map(category => `
        <button
            type="button"
            class="${currentCategory === category ? "active" : ""}"
            data-category="${escapeHTML(category)}"
        >
            ${escapeHTML(category)}
        </button>
    `).join("");
}

// Display food menu
function renderMenu() {
    const filtered = currentCategory === "All"
        ? FOOD_MENU
        : FOOD_MENU.filter(food => food.category === currentCategory);

    foodGrid.innerHTML = filtered.map(food => `
        <article class="food-card">
            <div class="food-photo">${escapeHTML(food.image)}</div>

            <div class="food-details">
                <h3>${escapeHTML(food.name)}</h3>
                <p>${escapeHTML(food.description)}</p>

                <div class="food-action">
                    <strong>฿${Number(food.price)}</strong>

                    <button
                        type="button"
                        data-add="${food.id}"
                    >
                        + Add
                    </button>
                </div>
            </div>
        </article>
    `).join("");
}

// Add food to cart
function addToCart(id) {
    const food = FOOD_MENU.find(item => item.id === id);

    if (!food) return;

    const existing = cart.find(item => item.id === id);

    if (existing) {
        existing.quantity++;
    } else {
        cart.push({
            ...food,
            quantity: 1
        });
    }

    renderCart();
}

// Remove one item
function removeFromCart(id) {
    const item = cart.find(food => food.id === id);

    if (!item) return;

    item.quantity--;

    if (item.quantity <= 0) {
        cart = cart.filter(food => food.id !== id);
    }

    renderCart();
}

// Calculate total
function getTotal() {
    return cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );
}

// Display cart
function renderCart() {
    if (cart.length === 0) {
        cartItems.textContent = "Your cart is empty.";
    } else {
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-row">
                <span>
                    ${escapeHTML(item.image)}
                    ${escapeHTML(item.name)} × ${item.quantity}
                </span>

                <span>
                    ฿${item.price * item.quantity}

                    <button
                        type="button"
                        data-remove="${item.id}"
                    >−</button>
                </span>
            </div>
        `).join("");
    }

    cartTotal.textContent =
        "Total: ฿" + getTotal().toFixed(2);
}

// Display customer's own orders
function renderCustomerOrders(orders) {
    if (!orders || orders.length === 0) {
        trackingMessage.textContent =
            "Your orders will appear here after ordering.";
        customerOrders.innerHTML = "";
        return;
    }

    trackingMessage.textContent = "Track your orders below.";

    const statuses = ["Pending", "Preparing", "Completed"];

    customerOrders.innerHTML = orders.map(order => {
        const currentStatus = statuses.includes(order.status)
            ? order.status
            : "Pending";

        const currentIndex = statuses.indexOf(currentStatus);

        const items = Array.isArray(order.item) ? order.item : [];

        const itemHTML = items.map(item => `
            <p>
                ${escapeHTML(item.name)}
                × ${Number(item.quantity) || 0}
            </p>
        `).join("");

        const progressHTML = statuses.map((status, index) => `
            <span class="tracking-step ${index <= currentIndex ? "active" : ""}">
                ${status}
            </span>
        `).join("");

        return `
            <div class="tracking-order">
                <strong>
                    Order #${escapeHTML(String(order.id).slice(-5).toUpperCase())}
                </strong>

                <p>Table ${escapeHTML(order.table_number)}</p>

                <div>${itemHTML}</div>

                <p class="tracking-status">
                    Status: ${escapeHTML(currentStatus)}
                </p>

                <div class="tracking-progress">
                    ${progressHTML}
                </div>
            </div>
        `;
    }).join("");
}

// Load only this customer's orders
async function loadMyOrders() {
    if (!customerId) return;

    const { data, error } = await window.tableFlowSupabase
        .from("order")
        .select("id, table_number, item, status, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Tracking error:", error);
        trackingMessage.textContent =
            "Unable to load your orders. Please refresh the page.";
        return;
    }

    renderCustomerOrders(data);
}

// Initialize customer session and tracking
async function initializeCustomer() {
    try {
        const user = await ensureCustomerSession();

        customerId = user.id;

        await loadMyOrders();

        if (trackingTimer) {
            clearInterval(trackingTimer);
        }

        trackingTimer = setInterval(loadMyOrders, 5000);

    } catch (error) {
        console.error("Customer login error:", error);

        trackingMessage.textContent =
            "Unable to connect. Please refresh the page.";
    }
}

// Confirm order
async function confirmOrder() {
    if (isSubmitting) return;

    const table = Number(
        document.getElementById("tableNumber").value
    );

    if (!Number.isInteger(table) || table < 1 || table > 999) {
        alert("Please enter a valid table number.");
        return;
    }

    if (cart.length === 0) {
        alert("Please select food first.");
        return;
    }

    isSubmitting = true;

    try {
        if (!customerId) {
            const user = await ensureCustomerSession();
            customerId = user.id;
        }

        const newOrder = {
            id: crypto.randomUUID(),
            customer_id: customerId,
            table_number: table,
            note: "Customer online order",
            status: "Pending",
            item: cart.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price
            })),
            created_at: Date.now()
        };

        const { error } = await window.tableFlowSupabase
            .from("order")
            .insert([newOrder]);

        if (error) {
            console.error("Supabase error:", error);
            alert("Order failed. Please try again.");
            return;
        }

        alert("Order submitted successfully! You can track it below.");

        cart = [];
        renderCart();

        document.getElementById("tableNumber").value = "";

        await loadMyOrders();

    } catch (error) {
        console.error("Order error:", error);
        alert("Connection error. Please try again.");
    } finally {
        isSubmitting = false;
    }
}

// Category selection
categories.addEventListener("click", event => {
    const button = event.target.closest("[data-category]");
    if (!button) return;

    currentCategory = button.dataset.category;
    renderCategories();
    renderMenu();
});

// Add food button
foodGrid.addEventListener("click", event => {
    const button = event.target.closest("[data-add]");
    if (!button) return;

    const foodId = Number(button.dataset.add);
    addToCart(foodId);
});

// Remove food button
cartItems.addEventListener("click", event => {
    const button = event.target.closest("[data-remove]");
    if (!button) return;

    const foodId = Number(button.dataset.remove);
    removeFromCart(foodId);
});

// Confirm button
document.getElementById("confirmBtn")
    .addEventListener("click", confirmOrder);

// Start
renderCategories();
renderMenu();
renderCart();
initializeCustomer();
