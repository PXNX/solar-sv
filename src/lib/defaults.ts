import type { ColorOption } from './ColorOption';
import type { MapSource } from './MapSource';

export const presetColors: ColorOption[] = [
	{ color: '#ffcc00', useDarkFont: true }, // Yellow
	{ color: '#ff00ff', useDarkFont: false }, // Magenta
	{ color: '#800080', useDarkFont: false }, // Purple
	{ color: '#00ffff', useDarkFont: true }, // Cyan
	{ color: '#00ff00', useDarkFont: true } // Green
];

export const defaultMapSources: MapSource[] = [
	{
		name: 'Google Maps (Project Owl)',
		url: 'https://www.google.com/maps/d/embed?mid=1xPxgT8LtUjuspSOGHJc2VzA5O5jWMTE&ehbc=2E312F',
		isCustom: false
	},
	{
		name: 'Google Maps',
		url: 'https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d57879408.81242841!2d-46.32400534374999!3d21.06171584375!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1642678945123!5m2!1sen!2sus',
		isCustom: false
	},
	{
		name: 'Satellites.pro',
		url: 'https://satellites.pro/Ukraine_map#48.882780,37.924805,7',
		isCustom: false
	},
	{
		name: 'OpenStreetMap',
		url: 'https://www.openstreetmap.org/export/embed.html?bbox=-180%2C-85%2C180%2C85&layer=mapnik',
		isCustom: false
	},
	{
		name: 'OpenStreetMap (Dark)',
		url: 'https://umap.openstreetmap.fr/en/map/dark-mode_297704#6/48.591/-325.525',
		isCustom: false
	},
	{
		name: 'OpenTopoMap',
		url: 'https://opentopomap.org/#map=5/48.882780/37.924805',
		isCustom: false
	}
];
