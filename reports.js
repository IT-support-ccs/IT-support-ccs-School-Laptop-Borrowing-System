import { db } from './firebase.js';
import { collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const reportsTableBody = document.querySelector('#reportsTable tbody');
const loadReportsButton = document.getElementById('loadReportsButton');
const filterButton = document.getElementById('filterButton');
const exportReportsButton = document.getElementById('exportReportsButton');
const filterOptions = document.getElementById('filterOptions');

// إظهار خيارات الفلترة عند النقر
filterButton.addEventListener('click', () => {
    filterOptions.style.display = filterOptions.style.display === 'none' ? 'block' : 'none';
});

// تحميل التقارير عند النقر على زر "Load Reports"
loadReportsButton.addEventListener('click', () => {
    const filterDate = document.getElementById('filterDate').value;
    const filterStudent = document.getElementById('filterStudent').value.toLowerCase();
    const filterLaptop = document.getElementById('filterLaptop').value.toLowerCase();
    const filterCharger = document.getElementById('filterCharger').value.toLowerCase();

    loadReports(filterDate, filterStudent, filterLaptop, filterCharger);
});

// تفعيل زر تصدير التقارير
exportReportsButton.addEventListener('click', () => {
    exportReports();
});

// دالة تحميل التقارير
async function loadReports(filterDate, filterStudent, filterLaptop, filterCharger) {
    reportsTableBody.innerHTML = '';

    const querySnapshot = await getDocs(collection(db, "reports"));
    const reports = [];

    querySnapshot.forEach(doc => {
        const data = doc.data();
        reports.push(data);
    });

    // ترتيب التقارير من الأحدث إلى الأقدم
    reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // الحصول على تاريخ اليوم
    const today = new Date().toLocaleDateString();

    // عرض البيانات في الجدول
    reports.forEach(data => {
        const borrowedDate = new Date(data.timestamp).toLocaleDateString();

        // التحقق من فلاتر التاريخ والاسم (مع التركيز على تقارير اليوم)
        const matchesDate = borrowedDate === today; // فقط تقارير اليوم
        const matchesStudent = !filterStudent || data.details.studentName.toLowerCase().includes(filterStudent);
        const matchesLaptop = !filterLaptop || data.details.laptopName.toLowerCase().includes(filterLaptop);
        const matchesCharger = !filterCharger || data.details.chargerName.toLowerCase().includes(filterCharger);

        if (matchesDate && matchesStudent && matchesLaptop && matchesCharger) {
            const row = reportsTableBody.insertRow();
            row.insertCell(0).textContent = data.details.laptopName; // عرض اسم اللابتوب
            row.insertCell(1).textContent = data.details.chargerName; // عرض اسم الشاحن
            row.insertCell(2).textContent = data.details.studentName; // عرض اسم الطالب
            row.insertCell(3).textContent = data.details.borrowedAt; // تاريخ الإعارة
            row.insertCell(4).textContent = data.details.returnedAt; // تاريخ الاغلاق
        }
    });
}

// دالة تصدير التقارير كملف CSV
function exportReports() {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Laptop Name,Charger Name,Student Name,Borrowed At,Returned At\n"; // رؤوس الأعمدة

    // جمع البيانات من الجدول
    Array.from(reportsTableBody.rows).forEach(row => {
        const rowData = Array.from(row.cells).map(cell => cell.textContent);
        csvContent += rowData.join(",") + "\n"; // تحويل الصف إلى تنسيق CSV
    });

    // إنشاء وتنزيل ملف CSV
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "reports.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// العودة إلى الصفحة الرئيسية
document.getElementById('backToMainButton').onclick = () => {
    window.location.href = 'index.html';
};

// إضافة حدث للزر لمسح جميع التقارير
document.getElementById('clearReportsButton').addEventListener('click', async () => {
    const password = prompt("Please enter the password to clear all reports:");
    const correctPassword = "24@ccs*fms";   

    if (password === correctPassword) {
        const confirmation = confirm("Are you sure you want to clear all reports?");
        if (confirmation) {
            await clearAllReports();
            loadReports(); // إعادة تحميل التقارير بعد المسح
        }
    } else {
        alert("Incorrect password. Reports cannot be cleared.");
    }
});

// دالة لمسح كل التقارير
async function clearAllReports() {
    const querySnapshot = await getDocs(collection(db, "reports"));
    const deletePromises = [];
    
    querySnapshot.forEach(doc => {
        deletePromises.push(deleteDoc(doc.ref));
    });

    await Promise.all(deletePromises);
    alert("All reports have been cleared.");
}

// تحميل التقارير عند تحميل الصفحة
loadReports();
