const STORAGE_KEY = "restaurantOrders";
const ordersTableBody = document.getElementById("ordersTableBody");
const emptyState = document.getElementById("emptyState");
const orderModal = document.getElementById("orderModal");
const orderForm = document.getElementById("orderForm");
const itemsContainer = document.getElementById("itemsContainer");
const formTotal = document.getElementById("formTotal");
const formError = document.getElementById("formError");
const toast = document.getElementById("toast");
let orders = loadOrders();
let editingOrderId = null;
let toastTimer = null;
// Load saved orders from the browser.
function loadOrders() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        return Array.isArray(saved) ? saved : [];
    } catch {
        return [];
    }
}
// Save orders to the browser.
function saveOrders() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch {
        showToast("Could not save data in this browser.");
    }
}
// Escape user-entered text before displaying it in HTML.
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}
// Format prices in Thai baht.
function money(amount) {
    return new Intl.NumberFormat("en-TH", {
        style: "currency",
        currency: "THB",
        minimumFractionDigits: 2
    }).format(amount);
}
// Calculate the total for one order.
function orderTotal(order) {
    return order.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );
}
function createId() {
    return `${Date.now().toString(36)}-${Math.random()
        .toString(36).slice(2, 7)}`;
}
// Display orders and update the dashboard.
function renderOrders() {
    const query = document.getElementById("searchInput")
        .value.trim().toLowerCase();
    const status = document.getElementById("statusFilter").value;
    const filtered = orders.filter(order => {
        const matchesStatus =
            status === "all" || order.status === status;
        const searchableText = [
            `table ${order.table}`,
            order.table,
            order.note || "",
            ...order.items.map(item => item.name)
        ].join(" ").toLowerCase();
        return matchesStatus && searchableText.includes(query);
    }).sort((a, b) => b.createdAt - a.createdAt);
    document.getElementById("totalCount").textContent = orders.length;
    document.getElementById("pendingCount").textContent =
        orders.filter(order => order.status === "Pending").length;
    document.getElementById("preparingCount").textContent =
        orders.filter(order => order.status === "Preparing").length;
    document.getElementById("completedCount").textContent =
        orders.filter(order => order.status === "Completed").length;
    document.getElementById("resultsText").textContent =
        `Showing ${filtered.length} of ${orders.length} orders`;
    if (filtered.length === 0) {
        ordersTableBody.innerHTML = "";
        emptyState.style.display = "block";
        emptyState.querySelector("h3").textContent =
            orders.length === 0 ? "No orders yet" : "No matching orders";
        emptyState.querySelector("p").textContent =
            orders.length === 0
                ? "Add your first table order to get started."
                : "Try another search term or status filter.";
        document.getElementById("emptyAddBtn").style.display =
            orders.length === 0 ? "inline-block" : "none";
        return;
    }
    emptyState.style.display = "none";
    ordersTableBody.innerHTML = filtered.map(order => {
        const itemsMarkup = order.items.map(item => `
            <div class="food-line">
                <span>${escapeHTML(item.name)}</span>
                <span class="qty">× ${item.quantity}</span>
            </div>
        `).join("");
        return `
            <tr>
                <td>
                    <div class="order-id">
                        #${escapeHTML(order.id.slice(-5).toUpperCase())}
                    </div>
                    <div class="table-name">
                        Table ${escapeHTML(order.table)}
                    </div>
                </td>
                <td>
                    <div class="food-list">
                        ${itemsMarkup}
                        ${order.note ? `
                            <div class="order-note">
                                Note: ${escapeHTML(order.note)}
                            </div>
                        ` : ""}
                    </div>
                </td>
                <td>
                    <div class="total-price">
                        ${money(orderTotal(order))}
                    </div>
                </td>
                <td>
                    <span class="badge ${order.status}">
                        ${order.status}
                    </span>
                    <br>
                    <select
                        class="status-select"
                        data-action="status"
                        data-id="${escapeHTML(order.id)}"
                        aria-label="Change order status"
                    >
                        ${["Pending", "Preparing", "Completed"].map(
                            statusName => `
                                <option
                                    value="${statusName}"
                                    ${order.status === statusName ? "selected" : ""}
                                >
                                    ${statusName}
                                </option>
                            `
                        ).join("")}
                    </select>
                </td>
                <td>
                    <div class="action-group">
                        <button
                            class="action-btn"
                            type="button"
                            title="Edit order"
                            aria-label="Edit order"
                            data-action="edit"
                            data-id="${escapeHTML(order.id)}"
                        >✎</button>
                        <button
                            class="action-btn"
                            type="button"
                            title="Mark completed or reopen"
                            aria-label="Change order progress"
                            data-action="next"
                            data-id="${escapeHTML(order.id)}"
                        >${order.status === "Completed" ? "↺" : "✓"}</button>
                        <button
                            class="action-btn delete"
                            type="button"
                            title="Delete order"
                            aria-label="Delete order"
                            data-action="delete"
                            data-id="${escapeHTML(order.id)}"
                        >×</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}
// Add a food row to the form.
function addItemRow(item = {
    name: "",
    quantity: 1,
    price: ""
}) {
    const row = document.createElement("div");
    row.className = "item-row";

    const selectedFood = FOOD_MENU.find(
        food => food.name === item.name
    );

    const options = FOOD_MENU.map(food => `
        <option
            value="${escapeHTML(food.name)}"
            data-price="${food.price}"
            ${food.name === item.name ? "selected" : ""}
        >
            ${escapeHTML(food.name)} - ฿${food.price}
        </option>
    `).join("");

    // Keep old custom items available when editing old orders.
    const customOption = item.name && !selectedFood
        ? `<option value="${escapeHTML(item.name)}"
             data-price="${Number(item.price) || 0}" selected>
             ${escapeHTML(item.name)} - ฿${Number(item.price) || 0}
           </option>`
        : "";

    row.innerHTML = `
        <select class="item-name" required>
            <option value="">Select food menu</option>
            ${customOption}
            ${options}
        </select>

        <input
            class="item-qty"
            type="number"
            min="1"
            max="999"
            step="1"
            value="${Number(item.quantity) || 1}"
            required
        >

        <input
            class="item-price"
            type="number"
            value="${Number(item.price) || 0}"
            readonly
            aria-label="Food price"
        >

        <button
            class="remove-item"
            type="button"
        >×</button>
    `;

    const foodSelect = row.querySelector(".item-name");
    const priceInput = row.querySelector(".item-price");

    foodSelect.addEventListener("change", () => {
        const option = foodSelect.selectedOptions[0];

        priceInput.value = option.dataset.price || 0;

        updateFormTotal();
    });

    row.querySelector(".item-qty").addEventListener(
        "input",
        updateFormTotal
    );

    row.querySelector(".remove-item").addEventListener("click", () => {
        if (itemsContainer.children.length === 1) {
            showToast("An order must have at least one food item.");
            return;
        }

        row.remove();
        updateFormTotal();
    });

    itemsContainer.appendChild(row);
    updateFormTotal();
}
// Read food items from the form.
function readItems() {
    return [...itemsContainer.querySelectorAll(".item-row")]
        .map(row => {
            const select = row.querySelector(".item-name");
            const option = select.selectedOptions[0];

            return {
                name: select.value.trim(),
                quantity: Number(
                    row.querySelector(".item-qty").value
                ),
                price: Number(option?.dataset.price)
            };
        });
}
// Calculate the total while entering food items.
function updateFormTotal() {
    const total = readItems().reduce((sum, item) => {
        if (
            Number.isFinite(item.quantity) &&
            Number.isFinite(item.price)
        ) {
            return sum +
                Math.max(0, item.quantity) * Math.max(0, item.price);
        }
        return sum;
    }, 0);
    formTotal.textContent = money(total);
}
// Open the form for creating or editing an order.
function openModal(order = null) {
    editingOrderId = order ? order.id : null;
    orderForm.reset();
    itemsContainer.innerHTML = "";
    formError.textContent = "";
    document.getElementById("modalTitle").textContent =
        order ? "Edit Order" : "Create New Order";
    document.getElementById("saveOrderBtn").textContent =
        order ? "Save Changes" : "Save Order";
    document.getElementById("tableNumber").value =
        order ? order.table : "";
    document.getElementById("orderNote").value =
        order ? order.note || "" : "";
    document.getElementById("orderStatus").value =
        order ? order.status : "Pending";
    if (order && order.items.length) {
        order.items.forEach(item => addItemRow(item));
    } else {
        addItemRow();
    }
    orderModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    setTimeout(() => {
        document.getElementById("tableNumber").focus();
    }, 50);
}
// Close the form.
function closeModal() {
    orderModal.classList.add("hidden");
    document.body.style.overflow = "";
    editingOrderId = null;
}
// Show a small notification.
function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2600);
}
// Validate and save the order.
function saveOrder(event) {
    event.preventDefault();
    formError.textContent = "";
    const table = Number(
        document.getElementById("tableNumber").value
    );
    const note = document.getElementById("orderNote").value.trim();
    const status = document.getElementById("orderStatus").value;
    const items = readItems();
    if (!Number.isInteger(table) || table < 1 || table > 999) {
        formError.textContent =
            "Enter a valid table number from 1 to 999.";
        return;
    }
    const invalidItems = items.length === 0 || items.some(item =>
        !item.name ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        !Number.isFinite(item.price) ||
        item.price < 0 ||
        item.price > 999999
    );
    if (invalidItems) {
        formError.textContent =
            "Enter a food name, a quantity of 1 or more, and a valid price for every item.";
        return;
    }
    const now = Date.now();
    if (editingOrderId) {
        const index = orders.findIndex(
            order => order.id === editingOrderId
        );
        if (index === -1) {
            showToast("This order could not be found.");
            closeModal();
            return;
        }
        orders[index] = {
            ...orders[index],
            table,
            note,
            status,
            items,
            updatedAt: now
        };
        showToast("Order updated successfully.");
    } else {
        orders.push({
            id: createId(),
            table,
            note,
            status,
            items,
            createdAt: now,
            updatedAt: now
        });
        showToast("New order saved successfully.");
    }
    saveOrders();
    renderOrders();
    closeModal();
}
// Handle edit, delete, and quick status actions.
function handleTableAction(event) {
    const statusSelect = event.target.closest(
        '[data-action="status"]'
    );
    if (statusSelect && event.type === "change") {
        const order = orders.find(
            item => item.id === statusSelect.dataset.id
        );
        if (!order) return;
        order.status = statusSelect.value;
        order.updatedAt = Date.now();
        saveOrders();
        renderOrders();
        showToast(
            `Table ${order.table} status changed to ${order.status}.`
        );
        return;
    }
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const order = orders.find(
        item => item.id === button.dataset.id
    );
    if (!order) return;
    if (button.dataset.action === "edit") {
        openModal(order);
    }
    if (button.dataset.action === "next") {
        if (order.status === "Pending") {
            order.status = "Preparing";
        } else if (order.status === "Preparing") {
            order.status = "Completed";
        } else {
            order.status = "Pending";
        }
        order.updatedAt = Date.now();
        saveOrders();
        renderOrders();
        showToast(
            `Table ${order.table} is now ${order.status}.`
        );
    }
    if (button.dataset.action === "delete") {
        const confirmed = window.confirm(
            `Delete the entire order for Table ${order.table}?`
        );
        if (!confirmed) return;
        orders = orders.filter(item => item.id !== order.id);
        saveOrders();
        renderOrders();
        showToast("Order deleted.");
    }
}
// Connect buttons and form events.
document.getElementById("addOrderBtn").addEventListener(
    "click",
    () => openModal()
);
document.getElementById("emptyAddBtn").addEventListener(
    "click",
    () => openModal()
);
document.getElementById("closeModalBtn").addEventListener(
    "click",
    closeModal
);
document.getElementById("cancelBtn").addEventListener(
    "click",
    closeModal
);
document.getElementById("addItemBtn").addEventListener(
    "click",
    () => addItemRow()
);
orderForm.addEventListener("submit", saveOrder);
ordersTableBody.addEventListener("click", handleTableAction);
ordersTableBody.addEventListener("change", handleTableAction);
document.getElementById("searchInput").addEventListener(
    "input",
    renderOrders
);
document.getElementById("statusFilter").addEventListener(
    "change",
    renderOrders
);
orderModal.addEventListener("click", event => {
    if (event.target === orderModal) {
        closeModal();
    }
});
document.addEventListener("keydown", event => {
    if (
        event.key === "Escape" &&
        !orderModal.classList.contains("hidden")
    ) {
        closeModal();
    }
});
// Show saved orders when the page opens.

renderOrders();
window.addEventListener("pageshow", () => {
    orders = loadOrders();
    renderOrders();
});
