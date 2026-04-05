const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const DAY_MS = 24 * 60 * 60 * 1000;
const MENU_SLOT_BASE_DATE = '2000-01-03'; // Monday of Wk1
const parseLocalDate = (dateStr) => new Date(`${dateStr}T00:00:00`);
const getSessionWeeks = (session) => Number(session?.session_weeks) === 1 ? 1 : 2;

const getSlotLabel = (dateStr, sessionWeeks, weekdayStyle = 'short') => {
    const totalSlots = getSessionWeeks({ session_weeks: sessionWeeks }) * 7;
    const current = parseLocalDate(dateStr);
    const start = parseLocalDate(MENU_SLOT_BASE_DATE);
    const diffDays = Math.floor((current.getTime() - start.getTime()) / DAY_MS);
    const cycleIndex = ((diffDays % totalSlots) + totalSlots) % totalSlots;

    const slotDate = new Date(start);
    slotDate.setDate(slotDate.getDate() + cycleIndex);
    const dayName = slotDate.toLocaleDateString('en-US', { weekday: weekdayStyle });

    if (totalSlots === 7) {
        return dayName;
    }

    const weekNum = Math.floor(cycleIndex / 7) + 1;
    return `${dayName}, Wk${weekNum}`;
};

const generateReport = (session, items, messType, res) => {
    const doc = new PDFDocument({ margin: 50 });

    // Stream to response
    doc.pipe(res);

    // -- Header with precise positioning --
    const logoPath = path.join(__dirname, 'assets', 'vit-logo.png');
    const logoWidth = 100;
    let headerY = 30;

    if (fs.existsSync(logoPath)) {
        const logoX = doc.page.width - 50 - logoWidth; // Top-right corner
        doc.image(logoPath, logoX, headerY, { width: logoWidth });
    }

    // University name
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#1a237e')
       .text('VIT CHENNAI', 50, headerY, { align: 'center', width: 500 });
    headerY += 24;

    // Thin decorative line
    doc.strokeColor('#1a237e').lineWidth(1.5)
       .moveTo(200, headerY).lineTo(412, headerY).stroke();
    headerY += 10;

    // Report title
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#333333')
       .text('Hostel Menu Selection Report', 50, headerY, { align: 'center', width: 500 });
    headerY += 22;

    // Session info
    doc.font('Helvetica').fontSize(10).fillColor('#555555')
       .text(`Session: ${session.title}`, 50, headerY, { align: 'center', width: 500 });
    headerY += 16;
    doc.text(
        `${new Date(session.start_date).toLocaleDateString()} — ${new Date(session.end_date).toLocaleDateString()}`,
        50, headerY, { align: 'center', width: 500 }
    );
    headerY += 22;

    // Mess type banner
    const bannerHeight = 28;
    doc.rect(50, headerY, 500, bannerHeight).fill('#1a237e');
    doc.font('Helvetica-Bold').fillColor('white').fontSize(13)
       .text(`${messType.replace('_', ' ').toUpperCase()} MESS`, 50, headerY + 8, { align: 'center', width: 500 });
       
    if (session.status === 'finalized') {
        doc.fillColor('#ffd700').fontSize(10).text('★ FINALIZED', 50, headerY + 9, { align: 'right', width: 480 });
    }

    doc.fillColor('black').strokeColor('#aaaaaa').lineWidth(0.5);
    headerY += bannerHeight + 14;

    // Move doc cursor to after header
    doc.y = headerY;

    // -- Content --
    if (!items || items.length === 0) {
        doc.fontSize(12).text('No menu items found for this session/mess type.', { align: 'center' });
    } else {
        // Group items by Date -> Meal Type
        const groupedByDate = items.reduce((acc, item) => {
            const date = item.date_served;
            if (!acc[date]) acc[date] = {};
            if (!acc[date][item.meal_type]) acc[date][item.meal_type] = [];
            // Remove description, just use the item name.
            acc[date][item.meal_type].push(item.name);
            return acc;
        }, {});

        const drawVertLines = (startY, endY) => {
            doc.lineWidth(0.5).strokeColor('#cccccc');
            doc.moveTo(50, startY).lineTo(50, endY).stroke();
            doc.moveTo(140, startY).lineTo(140, endY).stroke();
            doc.moveTo(240, startY).lineTo(240, endY).stroke();
            doc.moveTo(345, startY).lineTo(345, endY).stroke();
            doc.moveTo(445, startY).lineTo(445, endY).stroke();
            doc.moveTo(550, startY).lineTo(550, endY).stroke();
        };

        let y = doc.y;

        const drawTableHeader = () => {
            doc.moveTo(50, y).lineTo(550, y).strokeColor('#1a237e').lineWidth(1.5).stroke();
            doc.rect(50, y, 500, 25).fill('#e8eaf6');
            doc.fillColor('#1a237e').font('Helvetica-Bold').fontSize(10);
            const textY = y + 8;
            doc.text('Date', 52, textY, { width: 86, align: 'center' });
            doc.text('Breakfast', 145, textY, { width: 90, align: 'center' });
            doc.text('Lunch', 245, textY, { width: 95, align: 'center' });
            doc.text('Snacks', 350, textY, { width: 90, align: 'center' });
            doc.text('Dinner', 450, textY, { width: 95, align: 'center' });
            
            drawVertLines(y, y + 25);
            y += 25;
            doc.moveTo(50, y).lineTo(550, y).strokeColor('#1a237e').lineWidth(1.5).stroke();
        };

        drawTableHeader();

        let isEvenRow = false;
        Object.keys(groupedByDate).sort().forEach(date => {
            const dateStr = getSlotLabel(date, session.session_weeks, 'short');

            const meals = groupedByDate[date];
            const formatMeal = (mealArr) => mealArr ? mealArr.map(m => `• ${m}`).join('\n') : '-';
            
            const bf = formatMeal(meals['breakfast']);
            const lu = formatMeal(meals['lunch']);
            const sn = formatMeal(meals['snacks']);
            const dn = formatMeal(meals['dinner']);

            doc.font('Helvetica').fontSize(9).fillColor('#333333');
            const options = { width: 90, align: 'left' };
            const optionsWide = { width: 95, align: 'left' };
            const centerOptions = { width: 85, align: 'center' };

            // Calculate heights with slightly more padding
            const hDate = doc.heightOfString(dateStr, centerOptions);
            const hBf = doc.heightOfString(bf, options);
            const hLu = doc.heightOfString(lu, optionsWide);
            const hSn = doc.heightOfString(sn, options);
            const hDn = doc.heightOfString(dn, optionsWide);

            const rowHeight = Math.max(hDate, hBf, hLu, hSn, hDn) + 24;

            if (y + rowHeight > doc.page.height - 50) {
                doc.addPage();
                y = 50;
                drawTableHeader();
            }

            const startY = y;
            
            // Zebra striping
            if (isEvenRow) {
                doc.rect(50, y, 500, rowHeight).fill('#f9fafb');
            }
            doc.fillColor('#333333'); // reset text color
            isEvenRow = !isEvenRow;

            doc.text(dateStr, 52, y + 12, centerOptions);
            doc.text(bf, 145, y + 12, options);
            doc.text(lu, 245, y + 12, optionsWide);
            doc.text(sn, 350, y + 12, options);
            doc.text(dn, 450, y + 12, optionsWide);

            y += rowHeight;
            drawVertLines(startY, y);
            doc.moveTo(50, y).lineTo(550, y).lineWidth(0.5).strokeColor('#cccccc').stroke();
        });
    }

    // Footer
    const bottom = doc.page.height - 20;
    doc.fontSize(9).fillColor('#666666').text('Generated by Hostel Menu System', 50, bottom, { align: 'center', width: 500 });

    doc.end();
};

module.exports = { generateReport };
