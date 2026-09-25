import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { Branding, Customer } from '$lib/branding';
import type { PanelSettings, Roof, RoofLayout } from '$lib/solar/layout';
import type { Economics, EconomicsResult } from '$lib/solar/economics';
import type { RoofYield } from '$lib/solar/yield';
import { compassLabel, formatDate, formatEuro, formatNumber } from '$lib/utils/format';
import { m } from '$lib/paraglide/messages';

export interface ProposalInput {
	branding: Branding;
	customer: Customer;
	settings: PanelSettings;
	roofs: Roof[];
	layouts: RoofLayout[];
	yields: RoofYield[];
	economics: Economics;
	result: EconomicsResult;
	map: HTMLCanvasElement;
	/** Plain-text credits of the imagery shown on the map. */
	imageryCredits?: string[];
	date?: Date;
}

type RGB = [number, number, number];
const INK: RGB = [20, 40, 63];
const MUTED: RGB = [105, 114, 128];
const AMBER: RGB = [230, 165, 39];
const PAPER: RGB = [247, 242, 232];
const RULE: RGB = [226, 219, 205];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const FOOTER_Y = PAGE_H - 10;

/**
 * The built-in PDF fonts only cover WinAnsi. Intl output may contain narrow/thin spaces
 * that would render as garbage, so map them to plain spaces.
 */
function safe(text: string): string {
	return text.replace(/[\u202f\u2009\u2007]/g, ' ');
}

function lastTableY(doc: jsPDF): number {
	return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

export function createProposalPdf(input: ProposalInput): Blob {
	const { branding, customer, settings, roofs, layouts, yields, economics, result, map } = input;
	const date = input.date ?? new Date();
	const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
	doc.setProperties({
		title: safe(`${m.report_title()} - ${customer.name || customer.address}`),
		author: branding.consultant || branding.companyName,
		creator: m.app_name()
	});

	const text = (value: string, x: number, y: number, options?: Parameters<jsPDF['text']>[3]) =>
		doc.text(safe(value), x, y, options);
	const font = (size: number, style: 'normal' | 'bold' = 'normal', color: RGB = INK) => {
		doc.setFont('helvetica', style);
		doc.setFontSize(size);
		doc.setTextColor(...color);
	};

	// Header: logo + company on the left, document title on the right.
	let headerX = MARGIN;
	if (branding.logo) {
		const props = doc.getImageProperties(branding.logo);
		const h = 14;
		const w = Math.min(48, (props.width / props.height) * h);
		const drawnH = (w / props.width) * props.height;
		doc.addImage(branding.logo, 'PNG', MARGIN, 14 + (h - drawnH) / 2, w, drawnH);
		headerX = MARGIN + w + 5;
	}
	font(13, 'bold');
	text(branding.companyName || m.app_name(), headerX, 19.5);
	font(8.5, 'normal', MUTED);
	const contact = [branding.website, branding.email, branding.phone].filter(Boolean).join('  ·  ');
	if (contact) text(contact, headerX, 25);

	font(18, 'bold');
	text(m.report_title(), PAGE_W - MARGIN, 20, { align: 'right' });
	font(9, 'normal', MUTED);
	text(formatDate(date), PAGE_W - MARGIN, 25.5, { align: 'right' });

	doc.setDrawColor(...AMBER);
	doc.setLineWidth(0.8);
	doc.line(MARGIN, 32, PAGE_W - MARGIN, 32);

	// Customer and consultant block.
	let y = 41;
	const colW = CONTENT_W / 2 - 4;
	const label = (value: string, x: number, atY: number) => {
		font(7.5, 'bold', MUTED);
		text(value.toUpperCase(), x, atY);
	};
	label(m.report_customer(), MARGIN, y);
	font(11, 'bold');
	text(customer.name || '—', MARGIN, y + 5.5);
	label(m.report_address(), MARGIN, y + 12);
	font(9.5);
	const addressLines = doc.splitTextToSize(safe(customer.address || '—'), colW);
	doc.text(addressLines, MARGIN, y + 17);

	const rightX = MARGIN + CONTENT_W / 2 + 4;
	label(m.report_prepared_by(), rightX, y);
	font(11, 'bold');
	text(branding.consultant || branding.companyName || '—', rightX, y + 5.5);
	font(9.5);
	const preparedLines = [
		branding.consultant ? branding.companyName : '',
		branding.email,
		branding.phone
	].filter(Boolean);
	preparedLines.forEach((line, i) => text(line, rightX, y + 11 + i * 4.6));

	y += Math.max(17 + addressLines.length * 4.4, 11 + preparedLines.length * 4.6) + 5;

	// Map, scaled to the content width but capped in height.
	const maxMapH = 100;
	let mapW = CONTENT_W;
	let mapH = (map.height / map.width) * mapW;
	if (mapH > maxMapH) {
		mapH = maxMapH;
		mapW = (map.width / map.height) * mapH;
	}
	const mapX = MARGIN + (CONTENT_W - mapW) / 2;
	doc.addImage(map.toDataURL('image/jpeg', 0.88), 'JPEG', mapX, y, mapW, mapH);
	doc.setDrawColor(...RULE);
	doc.setLineWidth(0.3);
	doc.rect(mapX, y, mapW, mapH);
	y += mapH + 4;
	font(7.5, 'normal', MUTED);
	const credits = input.imageryCredits?.length
		? ` ${m.report_imagery_credit({ sources: input.imageryCredits.join('; ') })}`
		: '';
	const caption = doc.splitTextToSize(safe(m.report_map_caption() + credits), CONTENT_W);
	doc.text(caption, MARGIN, y);
	y += caption.length * 3.4 + 4;

	// Key figures.
	const totalPanels = layouts.reduce((sum, l) => sum + l.panels.length, 0);
	const totalKwp = (totalPanels * settings.watts) / 1000;
	const totalPanelArea = layouts.reduce((sum, l) => sum + l.panelArea, 0);
	const kpis = [
		[m.report_kpi_modules(), formatNumber(totalPanels)],
		[m.report_kpi_power(), `${formatNumber(totalKwp, 2)} kWp`],
		[m.report_kpi_area(), `${formatNumber(totalPanelArea, 1)} m²`],
		[m.report_kpi_cost(), formatEuro(totalPanels * settings.cost, false)]
	];
	const gap = 4;
	const boxW = (CONTENT_W - gap * (kpis.length - 1)) / kpis.length;
	kpis.forEach(([name, value], i) => {
		const x = MARGIN + i * (boxW + gap);
		doc.setFillColor(...PAPER);
		doc.roundedRect(x, y, boxW, 18, 2, 2, 'F');
		font(13, 'bold', i === 1 ? ([176, 118, 12] as RGB) : INK);
		text(value, x + 4, y + 8);
		font(7.5, 'normal', MUTED);
		text(name, x + 4, y + 13.5);
	});
	y += 18 + 8;

	// Per-roof table.
	font(11, 'bold');
	text(m.report_roofs(), MARGIN, y);
	const rows = roofs.map((roof, i) => {
		const layout = layouts[i];
		const kwp = (layout.panels.length * settings.watts) / 1000;
		return [
			`${i + 1}  ${roof.name}`,
			`${roof.pitch}°`,
			`${compassLabel(layout.azimuth)} (${layout.azimuth.toFixed(0)}°)`,
			formatNumber(layout.panels.length),
			formatNumber(kwp, 2),
			`${formatNumber(layout.roofArea, 1)} m²`,
			formatNumber(kwp * yields[i].specific),
			formatEuro(layout.panels.length * settings.cost, false)
		].map(safe);
	});
	const totalRoofArea = layouts.reduce((sum, l) => sum + l.roofArea, 0);
	autoTable(doc, {
		startY: y + 3,
		margin: { left: MARGIN, right: MARGIN, bottom: 18 },
		head: [
			[
				m.col_roof(),
				m.col_pitch(),
				m.col_facing(),
				m.col_modules(),
				m.col_power(),
				m.col_area(),
				m.col_yield(),
				m.col_cost()
			]
		],
		body: rows,
		foot: [
			[
				m.total(),
				'',
				'',
				formatNumber(totalPanels),
				formatNumber(totalKwp, 2),
				`${formatNumber(totalRoofArea, 1)} m²`,
				formatNumber(result.production),
				formatEuro(totalPanels * settings.cost, false)
			].map(safe)
		],
		theme: 'plain',
		styles: {
			font: 'helvetica',
			fontSize: 8.5,
			textColor: INK,
			cellPadding: { top: 2, bottom: 2, left: 2, right: 2 }
		},
		headStyles: {
			fontStyle: 'bold',
			textColor: MUTED,
			fontSize: 7.5,
			lineWidth: { bottom: 0.3 },
			lineColor: RULE
		},
		footStyles: { fontStyle: 'bold', fillColor: PAPER, textColor: INK },
		bodyStyles: { lineWidth: { bottom: 0.1 }, lineColor: RULE },
		columnStyles: {
			0: { cellWidth: 40 },
			3: { halign: 'right' },
			4: { halign: 'right' },
			5: { halign: 'right' },
			6: { halign: 'right' },
			7: { halign: 'right' }
		},
		didParseCell: (data) => {
			if (data.section !== 'body' && data.column.index >= 3) data.cell.styles.halign = 'right';
		}
	});
	y = lastTableY(doc) + 9;

	const ensureSpace = (needed: number) => {
		if (y + needed > PAGE_H - 22) {
			doc.addPage();
			y = MARGIN + 6;
		}
	};
	const half = CONTENT_W / 2 - 3;
	const keyValueTable = (startY: number, left: number, rows: string[][], highlightLast = false) => {
		autoTable(doc, {
			startY,
			margin: { left, right: PAGE_W - left - half, bottom: 18 },
			body: rows.map((row) => row.map(safe)),
			theme: 'plain',
			styles: { font: 'helvetica', fontSize: 8.5, textColor: INK, cellPadding: 1.6 },
			columnStyles: { 0: { textColor: MUTED }, 1: { halign: 'right', fontStyle: 'bold' } },
			bodyStyles: { lineWidth: { bottom: 0.1 }, lineColor: RULE },
			didParseCell: (data) => {
				if (highlightLast && data.row.index === rows.length - 1) {
					data.cell.styles.fillColor = PAPER;
					if (data.column.index === 1) data.cell.styles.textColor = [176, 118, 12];
				}
			}
		});
		return lastTableY(doc);
	};

	// Economics: results on the left, the assumptions behind them on the right.
	ensureSpace(60);
	font(11, 'bold');
	text(m.report_economics(), MARGIN, y);
	text(m.report_assumptions(), MARGIN + half + 6, y);
	const payback = Number.isFinite(result.payback)
		? m.years({ years: formatNumber(result.payback, 1) })
		: m.never();
	const resultsEnd = keyValueTable(
		y + 3,
		MARGIN,
		[
			[m.result_production(), m.kwh_per_year({ value: formatNumber(result.production) })],
			[m.result_autarky(), `${formatNumber(result.autarky * 100)} %`],
			[m.result_self_consumption(), `${formatNumber(result.selfConsumption * 100)} %`],
			[m.result_benefit(), formatEuro(result.annualBenefit, false)],
			[m.result_investment(), formatEuro(result.investment, false)],
			[m.result_payback(), payback],
			[
				m.result_lifetime_value({ years: result.lifetimeYears }),
				formatEuro(result.lifetimeValue, false)
			]
		],
		true
	);
	const battery = economics.battery.enabled
		? m.battery_summary({
				capacity: formatNumber(economics.battery.capacity, 1),
				price: formatEuro(economics.battery.price, false)
			})
		: m.battery_none();
	const assumptionsEnd = keyValueTable(y + 3, MARGIN + half + 6, [
		[m.field_consumption(), formatNumber(economics.consumption)],
		[m.field_electricity_price(), formatNumber(economics.electricityPrice, 3)],
		[m.field_feed_in(), formatNumber(economics.feedInTariff, 3)],
		[m.field_other_costs(), formatNumber(economics.otherCostsPerKwp)],
		[m.battery(), battery]
	]);
	y = Math.max(resultsEnd, assumptionsEnd) + 9;

	// Module specification with the disclaimer beside it.
	ensureSpace(45);
	font(11, 'bold');
	text(m.report_module_spec(), MARGIN, y);
	const orientation = settings.orientation === 'portrait' ? m.portrait() : m.landscape();
	const specEnd = keyValueTable(y + 3, MARGIN, [
		[
			m.spec_dimensions(),
			`${formatNumber(settings.length, 2)} × ${formatNumber(settings.width, 2)} m`
		],
		[m.spec_power(), `${formatNumber(settings.watts)} Wp`],
		[m.spec_mounting(), orientation],
		[m.spec_gap(), `${formatNumber(settings.gap * 100)} cm`],
		[m.spec_margin(), `${formatNumber(settings.margin * 100)} cm`],
		[m.spec_price(), formatEuro(settings.cost, false)]
	]);

	font(7.5, 'normal', MUTED);
	const notes = [m.report_disclaimer(), m.economics_hint()];
	if (yields.some((entry) => entry.source === 'pvgis')) notes.push(m.report_pvgis_credit());
	let noteY = y + 6;
	for (const note of notes) {
		const lines = doc.splitTextToSize(safe(note), half);
		doc.text(lines, MARGIN + half + 6, noteY);
		noteY += lines.length * 3.3 + 2;
	}
	y = Math.max(specEnd, noteY);

	// Footer on every page.
	const pages = doc.getNumberOfPages();
	for (let page = 1; page <= pages; page++) {
		doc.setPage(page);
		doc.setDrawColor(...RULE);
		doc.setLineWidth(0.2);
		doc.line(MARGIN, FOOTER_Y - 4, PAGE_W - MARGIN, FOOTER_Y - 4);
		font(7.5, 'normal', MUTED);
		text(
			[branding.companyName || m.app_name(), branding.website].filter(Boolean).join('  ·  '),
			MARGIN,
			FOOTER_Y
		);
		text(m.report_page({ page, pages }), PAGE_W - MARGIN, FOOTER_Y, { align: 'right' });
	}

	return doc.output('blob');
}
