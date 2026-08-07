/*---------------------------------------------------------------------------------------------
 *  Copyright (c) WalkCroach contributors. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsApp } from './App';
import './settings.css';

const container = document.getElementById('root');
if (container) {
	createRoot(container).render(
		<StrictMode>
			<SettingsApp />
		</StrictMode>,
	);
}
