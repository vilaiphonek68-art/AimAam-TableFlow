let cart = [];
let currentCategory = "All";

const foodGrid = document.getElementById("foodGrid");
const categories = document.getElementById("categories");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");

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
            data-category="${category}"
        >
            ${category}
        </button>
    `).join("");
}

// Display food menu
function renderMenu() {
    const filtered = currentCategory === "All"
        ? FOOD_MENU
        : FOOD_MENU.filter(
            food => food.category === currentCategory
        );

    foodGrid.innerHTML = filtered.map(food => `
        <article class="food-card">
            <div class="food-photo">${food.image}</div>

            <div class="food-details">
                <h3>${food.name}</h3>
                <p>${food.description}</p>

                <div class="food-action">
                    <strong>฿${food.price}</strong>

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
                    ${item.image} ${item.name} × ${item.quantity}
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

// Confirm order
async function confirmOrder() {
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

    const now = Date.now();

    const newOrder = {
        id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
        table_number: table,
        note: "Customer online order",
        status: "Pending",
        item: cart.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
        })),
        created_at: now,
    };

    try {
        const { error } = await window.tableFlowSupabase
            .from("order")
            .insert([newOrder]);

        if (error) {
            console.error("Supabase error:", error);
            alert("Order failed. Please try again.");
            return;
        }

        alert("Order submitted successfully!");

        cart = [];
        renderCart();

        document.getElementById("tableNumber").value = "";

    } catch (error) {
        console.error(error);
        alert("Connection error. Please try again.");
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
