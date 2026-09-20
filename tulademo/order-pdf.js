/* OrderPdf — comprobante del pedido en PDF para compartir por WhatsApp.
   Script clásico (sin módulos): expone globalThis.OrderPdf.
   - buildModel: puro y testeable, arma el modelo desde el payload del carrito.
   - renderDoc: dibuja el PDF con la clase jsPDF inyectada (window.jspdf.jsPDF).
   - sharePdf: entrega el archivo al menú compartir (WhatsApp) con fallback. */
(function () {
    'use strict';

    function num(n) {
        const v = Number(n);
        return Number.isFinite(v) ? v : 0;
    }

    function safeName(s) {
        return String(s == null ? '' : s)
            .replace(/[^a-zA-Z0-9-_]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60);
    }

    function buildModel(payload, companyName, orderId) {
        const rawItems = payload && Array.isArray(payload.items) ? payload.items : [];
        const items = rawItems.map((it) => ({
            name: String((it && (it.name || it.productName)) || '-'),
            quantity: Math.max(0, Math.floor(num(it && it.quantity))),
            price: num(it && it.price),
        }));
        const total = items.reduce((a, it) => a + it.quantity * it.price, 0);
        const id = String(orderId || '').trim();
        const file = safeName(id);
        const delivery = payload && payload.deliveryType === 'envio' ? 'Envío a domicilio' : 'Retiro en local';
        return {
            company: String(companyName || 'la tienda'),
            orderId: id,
            clientName: String((payload && payload.clientName) || '-'),
            clientPhone: String((payload && payload.clientPhone) || '-'),
            notes: String((payload && payload.notes) || ''),
            delivery: delivery,
            items: items,
            total: total,
            filename: file ? 'pedido-' + file + '.pdf' : 'pedido-web.pdf',
            date: new Date().toISOString(),
        };
    }

    function renderDoc(model, fmt, JsPDF) {
        const doc = new JsPDF({ unit: 'mm', format: 'a4' });
        const W = 190;
        let y = 18;
        const money = typeof fmt === 'function' ? fmt : (n) => String(n);
        const line = (text, size, bold, gap) => {
            doc.setFontSize(size || 11);
            try { doc.setFont(undefined, bold ? 'bold' : 'normal'); } catch (e) {}
            const parts = doc.splitTextToSize(String(text), W);
            for (const p of parts) {
                if (y > 280) { doc.addPage(); y = 18; }
                doc.text(p, 10, y);
                y += (gap || 6);
            }
        };
        line(model.company, 17, true, 8);
        line('Pedido' + (model.orderId ? ' ' + model.orderId : ''), 13, true, 6);
        line(new Date(model.date).toLocaleString(), 10, false, 4);
        line('Cliente: ' + model.clientName + '  -  Tel: ' + model.clientPhone, 11, false, 4);
        line('Entrega: ' + model.delivery, 11, false, 8);
        line('Detalle', 12, true, 6);
        for (const it of model.items) {
            line(it.quantity + ' x ' + it.name + '  ...  ' + money(it.quantity * it.price), 11, false, 6);
        }
        y += 2;
        line('TOTAL: ' + money(model.total), 14, true, 8);
        if (model.notes) line('Notas: ' + model.notes, 10, false, 5);
        return doc.output('blob');
    }

    async function sharePdf(file, title, nav) {
        try {
            const n = nav || (typeof navigator !== 'undefined' ? navigator : undefined);
            if (!n || typeof n.canShare !== 'function' || !n.canShare({ files: [file] })) {
                return 'unsupported';
            }
            await n.share({ files: [file], title: title || file.name });
            return 'shared';
        } catch (e) {
            if (e && e.name === 'AbortError') return 'cancelled';
            return 'error';
        }
    }

    globalThis.OrderPdf = { buildModel: buildModel, renderDoc: renderDoc, sharePdf: sharePdf };
})();
