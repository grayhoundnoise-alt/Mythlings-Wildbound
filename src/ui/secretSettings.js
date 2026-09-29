// =============================================================================
// SECRET SETTINGS — a hidden panel, opened with Ctrl + Del.
// =============================================================================
// Not linked from any menu and not listed in the normal Settings screen. One
// switch lives here: HD Images, which replaces Mythling art and battle
// backgrounds with pre-rendered PNGs wherever a PNG exists.
//
// Toggling it shows a short loading veil, because flipping the mode re-decodes
// every asset and the screen would otherwise pop between the two looks.
// =============================================================================
import { el, button, modal, toast, modalOpen } from './ui.js';
import { SettingsManager } from '../systems/SettingsManager.js';
import { setHdEnabled, preloadHdAssets, clearHdCache } from '../render/hdImages.js';
import { HD_ASSETS } from '../data/hdManifest.js';

let panelOpen = false;

/** How many Mythling forms / backgrounds actually have art, for the panel copy. */
function assetCounts() {
  let models = 0, bgs = 0;
  for (const k of Object.keys(HD_ASSETS)) {
    if (k.startsWith('model:')) models++;
    else if (k.startsWith('bg:')) bgs++;
  }
  return { models, bgs };
}

/** Apply the stored setting to the renderer. Called on boot and after a toggle. */
export function syncHdMode() {
  setHdEnabled(SettingsManager.get('hdImages'));
}

/**
 * Show the loading veil while assets decode. Resolves when they are ready (or
 * immediately on failure — HD mode then just falls back to the rig).
 */
function withLoadingVeil(label, work) {
  const veil = el('div', { class: 'hd-veil' }, [el('div', { class: 'hd-veil-box' }, [
    el('div', { class: 'hd-veil-spin' }),
    el('div', { class: 'hd-veil-text', text: label }),
  ])]);
  document.body.appendChild(veil);
  // One frame so the veil is actually painted before we start decoding.
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
    Promise.resolve(work())
      .catch(() => {})
      .then(() => {
        veil.classList.add('out');
        setTimeout(() => { veil.remove(); resolve(); }, 160);
      });
  })));
}

async function toggleHd() {
  const turningOn = !SettingsManager.get('hdImages');
  await withLoadingVeil(turningOn ? 'LOADING HD IMAGES…' : 'RESTORING ANIMATED ART…', async () => {
    SettingsManager.set('hdImages', turningOn);
    clearHdCache();
    setHdEnabled(turningOn);
    if (turningOn) await preloadHdAssets();
  });
}

/**
 * Open the panel. Resolves when it closes. Never opens on top of another modal
 * or while the player is typing a name.
 */
export async function openSecretSettings() {
  if (panelOpen) return;
  const ae = document.activeElement;
  if (ae && /input|textarea|select/i.test(ae.tagName || '')) return;
  if (modalOpen() && !panelOpen) return;    // don't stack on a real dialog
  panelOpen = true;

  const { models, bgs } = assetCounts();
  const row = el('div', { class: 'item-row' }, [
    el('div', { class: 'ir-main' }, [
      el('div', { class: 'ir-name', text: 'HD Images' }),
      el('div', {
        class: 'ir-desc',
        text: `Replace Mythling art and battle backgrounds with still images. `
            + `Only forms that have a picture are affected — the rest keep animating, `
            + `and the roaming map is never touched. Currently ${models} Mythling form`
            + `${models === 1 ? '' : 's'} and ${bgs} background${bgs === 1 ? '' : 's'} have art.`,
      }),
    ]),
  ]);
  const btn = button('OFF', { class: 'small ghost' });
  const paint = () => {
    const on = !!SettingsManager.get('hdImages');
    btn.textContent = on ? 'ON' : 'OFF';
    btn.className = `btn small ${on ? 'primary' : 'ghost'}`;
  };
  paint();
  btn.addEventListener('click', async () => {
    await toggleHd();
    paint();
    toast(SettingsManager.get('hdImages') ? 'HD Images ON' : 'HD Images OFF');
  });
  row.appendChild(btn);

  const body = el('div', { class: 'hd-secret' }, [
    el('p', { class: 'hd-secret-note', text: 'Hidden panel. Nothing here is linked from the menus.' }),
    row,
  ]);

  await modal({
    title: 'Secret Settings',
    body,
    buttons: [{ label: 'CLOSE', value: true, primary: true }],
  });
  panelOpen = false;
}

/**
 * The global hotkey. Returns true when it consumed the event, so the caller
 * knows not to treat Ctrl+Del as anything else.
 */
export function secretSettingsHotkey(e) {
  if (!(e.ctrlKey && e.key === 'Delete')) return false;
  e.preventDefault();
  e.stopPropagation();
  if (panelOpen) return true;
  openSecretSettings();
  return true;
}
