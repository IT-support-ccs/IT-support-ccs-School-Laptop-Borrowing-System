import { db } from './firebase.js';
import { collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const notification = document.getElementById('notification');
const borrowedTableBody = document.querySelector('#borrowedTable tbody');
const borrowForm = document.getElementById('borrowForm');

let laptopsData = [];
let chargersData = [];
let borrowedData = [];

// إظهار الرسائل
function showNotification(message, type) {
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    setTimeout(() => { notification.style.display = 'none'; }, 5000);
}

// تحديث العرض
async function updateInventoryDisplay() {
    const totalLaptops = laptopsData.length;
    const totalBorrowed = borrowedData.filter(item => !item.returnedAt).length;
    document.getElementById('totalLaptops').textContent = totalLaptops - totalBorrowed;
    document.getElementById('totalBorrowed').textContent = totalBorrowed;
}

// تحميل البيانات
async function loadData() {
    try {
        const laptopsSnapshot = await getDocs(collection(db, "laptops"));
        laptopsData = laptopsSnapshot.docs.map(doc => ({ barcode: doc.id, name: doc.data().name }));

        const chargersSnapshot = await getDocs(collection(db, "chargers"));
        chargersData = chargersSnapshot.docs.map(doc => ({ barcode: doc.id, name: doc.data().name }));

        const borrowedSnapshot = await getDocs(collection(db, "borrowed"));
        borrowedData = borrowedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        loadBorrowedItems();
        await updateInventoryDisplay();
    } catch (error) {
        console.error("Error loading data:", error);
        showNotification('Error loading data!', 'error');
    }
}

// تسجيل الاستعارة

async function getDeviceNameFromFirebase(barcode, collectionName) {
    try {
        const deviceDoc = await getDoc(doc(db, collectionName, barcode));
        if (deviceDoc.exists()) {
            return deviceDoc.data().name; // استرجاع اسم الجهاز
        } else {
            console.error(`Device with barcode ${barcode} not found in ${collectionName}!`);
            return barcode; // إذا لم يتم العثور على الجهاز، ارجع الباركود كبديل
        }
    } catch (error) {
        console.error("Error fetching device name from Firebase:", error);
        return barcode;
    }
}

async function borrowLaptop(studentName, laptopBarcode, chargerBarcode) {
    // تحقق إذا كان باركود اللابتوب هو باركود شاحن والعكس
    if (laptopBarcode === chargerBarcode) {
        showNotification('Cannot borrow a laptop with the same barcode as charger!', 'error');
        return;
    }

    // البحث عن الأجهزة
    const laptop = laptopsData.find(item => item.barcode === laptopBarcode);
    const charger = chargersData.find(item => item.barcode === chargerBarcode);

    // تحقق من وجود كل من اللابتوب والشاحن
    if (!laptop) {
        showNotification('Laptop not found!', 'error');
        return;
    }
    if (!charger) {
        showNotification('Charger not found!', 'error');
        return;
    }

    // تحقق مما إذا كانت اللابتوب قد تم استعارتها بالفعل
    if (borrowedData.some(item => item.laptopBarcode === laptopBarcode && !item.returnedAt)) {
        showNotification('This laptop is already borrowed!', 'error');
        return;
    }

    // تحقق مما إذا كانت الشاحن قد تم استعارتها بالفعل
    if (borrowedData.some(item => item.chargerBarcode === chargerBarcode && !item.returnedAt)) {
        showNotification('This charger is already borrowed!', 'error');
        return;
    }

    try {
        const borrowedDoc = await addDoc(collection(db, "borrowed"), {
            studentName,
            laptopName: laptop.name,
            chargerName: charger.name,
            borrowedAt: new Date().toISOString(),
            laptopBarcode,
            chargerBarcode,
            returnedAt: null
        });

        borrowedData.push({
            id: borrowedDoc.id,
            studentName,
            laptopName: laptop.name,
            chargerName: charger.name,
            laptopBarcode,
            chargerBarcode,
            borrowedAt: new Date().toISOString(),
            returnedAt: null
        });

        await saveReport("Borrow", { studentName, laptopBarcode, chargerBarcode });
        showNotification(`Laptop "${laptop.name}" borrowed successfully!`, 'success');
        await updateInventoryDisplay();
        loadBorrowedItems();
        borrowForm.reset();
    } catch (error) {
        console.error("Error borrowing laptop:", error);
        showNotification('Error borrowing laptop!', 'error');
    }
}


// تحميل الأجهزة المستعارة
function loadBorrowedItems() {
    borrowedTableBody.innerHTML = '';
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
function openReturnModal(expectedLaptopBarcode, expectedChargerBarcode) {
    document.getElementById('returnModal').style.display = 'block';
    // تأكد من أن الحقول فارغة قبل فتح النافذة
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

    const index = borrowedData.findIndex(item => item.laptopBarcode === returnLaptopBarcode && !item.returnedAt && item.chargerBarcode === returnChargerBarcode);
    if (index !== -1) {
        await returnItem(borrowedData[index]);
    } else {
        showNotification('Incorrect barcode information.', 'error');
    }
    closeModal();
}

// إعادة الجهاز
async function returnItem(borrowedItem) {
    try {
        // حذف السجل من قاعدة البيانات
        await deleteDoc(doc(db, "borrowed", borrowedItem.id));
        
        // إضافة موعد الإرجاع
        borrowedItem.returnedAt = new Date().toISOString();
        
        // إضافة السجل إلى التقارير
        await saveReport("Return", {
            studentName: borrowedItem.studentName,
            laptopName: borrowedItem.laptopName, // استخدام اسم اللابتوب
            chargerName: borrowedItem.chargerName, // استخدام اسم الشاحن
            returnedAt: borrowedItem.returnedAt
        });
        
        
        // إظهار رسالة النجاح
        showNotification('Laptop returned successfully!', 'success');
        
        // إزالة الجهاز من borrowedData
        borrowedData = borrowedData.filter(item => item.id !== borrowedItem.id);
        
        // تحديث العرض
        await updateInventoryDisplay();
        loadBorrowedItems(); // إعادة تحميل العناصر المستعارة
    } catch (error) {
        console.error("Error returning item:", error);
        showNotification('Error returning item!', 'error');
    }
}

// حفظ التقرير
async function saveReport(action, details) {
    try {
        await addDoc(collection(db, "reports"), {
            action,
            details,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error saving report:", error);
    }
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

// العودة إلى صفحة التقارير
document.getElementById('reportPageButton').onclick = () => {
    window.location.href = 'reports.html';
};

// إضافة معالج حدث لزر "Submit Return" في نافذة الإرجاع
document.querySelector('.modal .button-primary').onclick = async () => {
    await processReturn(); // تأكد من استخدام await هنا
};

// إضافة حدث النقر على علامة "X" لإغلاق النافذة المنبثقة
document.getElementById('closeModal').onclick = closeModal;

// إضافة حدث لإغلاق النافذة عند النقر خارجها
window.onclick = function(event) {
    const modal = document.getElementById('returnModal');
    if (event.target === modal) {
        closeModal();
    }
};
