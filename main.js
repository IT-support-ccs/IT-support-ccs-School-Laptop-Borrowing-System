import { db } from './firebase.js';
import { collection, addDoc, getDocs, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const notification = document.getElementById('notification');
const borrowedTableBody = document.querySelector('#borrowedTable tbody');
const borrowForm = document.getElementById('borrowForm');

// الأصوات
const successSound = new Audio('success.mp3');
const errorSound = new Audio('error.mp3');

// البيانات
let laptopsData = [];
let chargersData = [];
let borrowedData = [];

// عرض الإشعارات
function showNotification(message, type, sound) {
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';

    if (sound) sound.play();

    setTimeout(() => { notification.style.display = 'none'; }, 5000);
}

// تحديث النصوص في صفحة العرض
function updateElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

// تحديث المخزون
function updateInventoryDisplay() {
    const totalLaptops = laptopsData.length;
    const totalBorrowed = borrowedData.filter(item => !item.returnedAt).length;
    updateElementText('totalLaptops', totalLaptops - totalBorrowed);
    updateElementText('totalBorrowed', totalBorrowed);
}

// تعديل بيانات Firestore
async function modifyFirestoreCollection(action, collectionName, data, docId = null) {
    try {
        if (action === 'add') {
            const docRef = await addDoc(collection(db, collectionName), data);
            return { success: true, id: docRef.id };
        } else if (action === 'delete') {
            if (docId) {
                await deleteDoc(doc(db, collectionName, docId));
                return { success: true };
            } else {
                throw new Error("Document ID is required for deletion.");
            }
        }
    } catch (error) {
        console.error(`Error during ${action} in collection ${collectionName}:`, error);
        return { success: false, error };
    }
}

// تحميل البيانات
async function loadData() {
    try {
        const cachedLaptops = JSON.parse(localStorage.getItem('laptopsData'));
        const cachedChargers = JSON.parse(localStorage.getItem('chargersData'));

        if (cachedLaptops && cachedChargers) {
            laptopsData = cachedLaptops;
            chargersData = cachedChargers;
            updateInventoryDisplay();
        } else {
            const laptopsSnapshot = await getDocs(collection(db, "laptops"));
            laptopsData = laptopsSnapshot.docs.map(doc => ({ barcode: doc.id, name: doc.data().name }));
            localStorage.setItem('laptopsData', JSON.stringify(laptopsData));

            const chargersSnapshot = await getDocs(collection(db, "chargers"));
            chargersData = chargersSnapshot.docs.map(doc => ({ barcode: doc.id, name: doc.data().name }));
            localStorage.setItem('chargersData', JSON.stringify(chargersData));

            updateInventoryDisplay();
        }

        onSnapshot(collection(db, "borrowed"), (snapshot) => {
            borrowedData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            loadBorrowedItems();
            updateInventoryDisplay();
        });

    } catch (error) {
        console.error("Error loading data:", error);
        showNotification('Error loading data!', 'error', errorSound);
    }
}

// تسجيل الاستعارة
async function borrowLaptop(studentName, laptopBarcode, chargerBarcode) {
    if (laptopBarcode === chargerBarcode) {
        showNotification('Cannot borrow a laptop with the same barcode as charger!', 'error', errorSound);
        return;
    }

    const laptop = laptopsData.find(item => item.barcode === laptopBarcode);
    const charger = chargersData.find(item => item.barcode === chargerBarcode);
    if (!laptop || !charger) {
        showNotification('Laptop or Charger not found!', 'error', errorSound);
        return;
    }

    const alreadyBorrowed = borrowedData.some(item =>
        (!item.returnedAt &&
        (item.laptopBarcode === laptopBarcode || item.chargerBarcode === chargerBarcode))
    );
    if (alreadyBorrowed) {
        showNotification('Device already borrowed!', 'error', errorSound);
        return;
    }

    const newBorrowData = {
        studentName,
        laptopName: laptop.name,
        chargerName: charger.name,
        borrowedAt: new Date().toISOString(),
        laptopBarcode,
        chargerBarcode,
        returnedAt: null
    };

    const result = await modifyFirestoreCollection('add', 'borrowed', newBorrowData);
    if (result.success) {
        borrowedData.push({ id: result.id, ...newBorrowData });
        showNotification('Borrow successful!', 'success', successSound);
        await updateInventoryDisplay();
        loadBorrowedItems();
        borrowForm.reset();
    } else {
        showNotification('Error during borrowing!', 'error', errorSound);
    }
}

// إعادة الأجهزة
async function returnItem(borrowedItem) {
    const result = await modifyFirestoreCollection('delete', 'borrowed', null, borrowedItem.id);
    if (result.success) {
        borrowedItem.returnedAt = new Date().toISOString();
        borrowedData = borrowedData.filter(item => item.id !== borrowedItem.id);
        showNotification('Return successful!', 'success', successSound);
        await updateInventoryDisplay();
        loadBorrowedItems();
    } else {
        showNotification('Error during return!', 'error', errorSound);
    }
}

// عرض العناصر المستعارة
// تحميل الأجهزة المستعارة
function loadBorrowedItems() {
    borrowedTableBody.innerHTML = '';

    // ترتيب البيانات من الأقدم إلى الأحدث بناءً على تاريخ الاستعارة
    borrowedData.sort((a, b) => new Date(a.borrowedAt) - new Date(b.borrowedAt));

    borrowedData.forEach(data => {
        const row = borrowedTableBody.insertRow();
        row.insertCell(0).textContent = data.laptopName;
        row.insertCell(1).textContent = data.chargerName;
        row.insertCell(2).textContent = data.studentName;
        row.insertCell(3).textContent = new Date(data.borrowedAt).toLocaleString();
        const returnCell = row.insertCell(4);
        const returnButton = document.createElement('button');
        returnButton.textContent = 'Return';
        returnButton.onclick = () => openReturnModal(data.laptopBarcode, data.chargerBarcode);
        returnCell.appendChild(returnButton);
    });
}


// فتح نافذة الإرجاع
function openReturnModal() {
    document.getElementById('returnModal').style.display = 'block';
    document.getElementById('returnLaptopBarcode').value = '';
    document.getElementById('returnChargerBarcode').value = '';
}

// إغلاق النافذة
function closeModal() {
    document.getElementById('returnModal').style.display = 'none';
}

// معالجة الإرجاع
async function processReturn() {
    const returnLaptopBarcode = document.getElementById('returnLaptopBarcode').value;
    const returnChargerBarcode = document.getElementById('returnChargerBarcode').value;

    const index = borrowedData.findIndex(item =>
        item.laptopBarcode === returnLaptopBarcode &&
        !item.returnedAt &&
        item.chargerBarcode === returnChargerBarcode
    );

    if (index !== -1) {
        await returnItem(borrowedData[index]);
    } else {
        showNotification('Incorrect barcode information.', 'error', errorSound);
    }
    closeModal();
}

// حدث إرسال النموذج
borrowForm.onsubmit = async (event) => {
    event.preventDefault();
    const studentName = document.getElementById('studentName').value;
    const laptopBarcode = document.getElementById('laptopBarcode').value;
    const chargerBarcode = document.getElementById('chargerBarcode').value;
    await borrowLaptop(studentName, laptopBarcode, chargerBarcode);
};

// تحميل البيانات عند تحميل الصفحة
loadData();

// إضافة الأحداث
document.getElementById('reportPageButton').onclick = () => {
    window.location.href = 'reports.html';
};
document.querySelector('.modal .button-primary').onclick = async () => {
    await processReturn();
};
document.getElementById('closeModal').onclick = closeModal;
window.onclick = function(event) {
    const modal = document.getElementById('returnModal');
    if (event.target === modal) {
        closeModal();
    }
};
