const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

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
       .text(`${messType.replace('_', ' ').toUpperCase()} MESS`, 50, headerY + 7, { align: 'center', width: 500 });
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
            doc.moveTo(50, startY).lineTo(50, endY).stroke();
            doc.moveTo(140, startY).lineTo(140, endY).stroke();
            doc.moveTo(240, startY).lineTo(240, endY).stroke();
            doc.moveTo(345, startY).lineTo(345, endY).stroke();
            doc.moveTo(445, startY).lineTo(445, endY).stroke();
            doc.moveTo(550, startY).lineTo(550, endY).stroke();
        };

        let y = doc.y;

        const drawTableHeader = () => {
            doc.moveTo(50, y).lineTo(550, y).strokeColor('#aaaaaa').stroke();
            doc.rect(50, y, 500, 25).fill('#eeeeee');
            doc.fillColor('#000000').font('Helvetica-Bold').fontSize(10);
            const textY = y + 8;
            doc.text('Date', 55, textY, { width: 80, align: 'center' });
            doc.text('Breakfast', 145, textY, { width: 90, align: 'center' });
            doc.text('Lunch', 245, textY, { width: 95, align: 'center' });
            doc.text('Snacks', 350, textY, { width: 90, align: 'center' });
            doc.text('Dinner', 450, textY, { width: 95, align: 'center' });
            
            drawVertLines(y, y + 25);
            y += 25;
            doc.moveTo(50, y).lineTo(550, y).stroke();
        };

        drawTableHeader();

        Object.keys(groupedByDate).sort().forEach(date => {
            const current = new Date(date);
            const start = new Date(session.start_date);
            current.setHours(0,0,0,0);
            start.setHours(0,0,0,0);
            const diffDays = Math.round((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            const weekNum = Math.floor(diffDays / 7) + 1;
            
            const dayName = current.toLocaleDateString('en-US', { weekday: 'short' });
            const dateStr = `${dayName}, Wk${weekNum}`;

            const meals = groupedByDate[date];
            const formatMeal = (mealArr) => mealArr ? mealArr.map(m => `• ${m}`).join('\n') : '-';
            
            const bf = formatMeal(meals['breakfast']);
            const lu = formatMeal(meals['lunch']);
            const sn = formatMeal(meals['snacks']);
            const dn = formatMeal(meals['dinner']);

            doc.font('Helvetica').fontSize(9);
            const options = { width: 90, align: 'left' };
            const optionsWide = { width: 95, align: 'left' };
            const centerOptions = { width: 85, align: 'center' };

            // Calculate heights
            const hDate = doc.heightOfString(dateStr, centerOptions);
            const hBf = doc.heightOfString(bf, options);
            const hLu = doc.heightOfString(lu, optionsWide);
            const hSn = doc.heightOfString(sn, options);
            const hDn = doc.heightOfString(dn, optionsWide);

            const rowHeight = Math.max(hDate, hBf, hLu, hSn, hDn) + 20;

            if (y + rowHeight > doc.page.height - 50) {
                doc.addPage();
                y = 50;
                drawTableHeader();
            }

            const startY = y;
            doc.text(dateStr, 52, y + 10, centerOptions);
            doc.text(bf, 145, y + 10, options);
            doc.text(lu, 245, y + 10, optionsWide);
            doc.text(sn, 350, y + 10, options);
            doc.text(dn, 450, y + 10, optionsWide);

            y += rowHeight;
            drawVertLines(startY, y);
            doc.moveTo(50, y).lineTo(550, y).stroke();
        });
    }

    // Footer
    const bottom = doc.page.height - 40;
    doc.fontSize(9).fillColor('#666666').text('Generated by Hostel Menu System', 50, bottom, { align: 'center', width: 500 });

    doc.end();
};

module.exports = { generateReport };
