// 素材資料類別
class EffectAsset {
    constructor(id, displayName, type = 'preset', data = null) {
        this.id = id;
        this.displayName = displayName;
        this.type = type;
        this.params = data ? JSON.parse(JSON.stringify(data)) : this._createDefaultParams(id);
    }

    _createDefaultParams(id) {
        return {
            color: "#ffffff",
            XH: { func: "none", value: 0, range: 0, lower: 0, upper: 0, height: 0, step: 0, top: 0 },
            XS: { func: "none", value: 0, range: 0, lower: 0, upper: 0, height: 0, step: 0, top: 0 },
            XV: { func: "none", value: 0, range: 0, lower: 0, upper: 0, height: 0, step: 0, top: 0 },
            YH: { func: "none", value: 0, range: 0, lower: 0, upper: 0, height: 0, step: 0, top: 0 },
            YS: { func: "none", value: 0, range: 0, lower: 0, upper: 0, height: 0, step: 0, top: 0 },
            YV: { func: "none", value: 0, range: 0, lower: 0, upper: 0, height: 0, step: 0, top: 0 },
            extra: {
                bladeCount: 3, length: 150, curvature: 50, 
                boxsize: 50, position_fix: 128, space: 10, reverse: 0
            }
        };
    }
}

// 面板管理器
class Inspector {
    constructor() {
        this.el = document.querySelector('.param_main');
        this.emptyMsg = document.querySelector('.param_empty');
        this.currentAsset = null; // 記錄目前正在編輯哪個物件
        this.resetToEmpty();
        this.initSyncEvents();
    }

    resetToEmpty() {
        this.emptyMsg.classList.remove('hidden');
        this.el.classList.add('hidden');
    }

    initSyncEvents() {
        this.el.addEventListener('input', (e) => {
            const target = e.target;
            if (!this.currentAsset) return;

            // A. 處理數字與滑桿同步 (所有模式都要同步 UI)
            if (target.matches('input[type="number"], input[type="range"]')) {
                const row = target.closest('.param_input_row');
                if (row) {
                    const other = row.querySelector(target.type === 'number' ? 'input[type="range"]' : 'input[type="number"]');
                    if (other) other.value = target.value;
                }
            }

            // B. 【關鍵修正】只有 custom 模式才即時存入物件，preset 模式僅維持 UI 變動
            if (this.currentAsset.type === 'custom') {
                this.updateDataFromUI(target);
                window.app.markDirty();
            } else {
                // 如果是 preset，我們不更新 currentAsset.params
                // 這樣下次點回來時，loadParamsToUI 會重新讀取原始的預設值
                console.log("預設模式：僅改動 UI，不影響原始設定");
            }
        });
    }

    open(assetObj) {
        // 如果是預設素材，我們每次點擊都重新生成一份參數 (重置)
        if (assetObj.type === 'preset') {
            assetObj.params = assetObj._createDefaultParams(assetObj.id);
        }
        
        this.currentAsset = assetObj;
        this.emptyMsg.classList.add('hidden');
        this.el.classList.remove('hidden');
        this.el.setAttribute('data-asset-type', assetObj.type);

        if (assetObj.id === "MODES_CLEAR") {
            this.el.classList.add('is-clear-mode');
            return;
        } else {
            this.el.classList.remove('is-clear-mode');
        }

        this.updateExtraGroups(assetObj.id);
        this.loadParamsToUI(assetObj.params);
    }
    /**
     * 根據目前操作的 UI 元素，自動定位並更新 currentAsset.params 的值
     */
    updateDataFromUI(target) {
        const paramKey = target.dataset.param; 
        if (!paramKey) return;

        // 判斷是否需要轉數字
        let value = target.value;
        if (target.type === 'number' || target.type === 'range') {
            value = parseInt(target.value) || 0; // 確保不會出現 NaN
        }

        if (paramKey.includes('_')) {
            const [group, key] = paramKey.split('_');
            if (this.currentAsset.params[group]) {
                this.currentAsset.params[group][key] = value;
            }
        } else if (paramKey === 'color') {
            this.currentAsset.params.color = value;
        } else {
            if (this.currentAsset.params.extra.hasOwnProperty(paramKey)) {
                this.currentAsset.params.extra[paramKey] = value;
            }
        }
    }

    // 將資料物件的數值填入 UI 所有的 Input 中
    loadParamsToUI(params) {
        if (!params) return;
        // 1. 顏色
        const colorInput = this.el.querySelector('.color_preview');
        if (colorInput) colorInput.value = params.color || "#ffffff";

        // 2. HSV 各組 (XH, XS, XV...)
        ['XH','XS','XV','YH','YS','YV'].forEach(key => {
            const config = params[key];
            const select = this.el.querySelector(`select[data-param="${key}_func"]`);
            if (select) {
                select.value = config.func;
                this.updateFunctionUI(select); // 切換對應的輸入框
            }
            // 填入 value, range, lower, upper 等
            Object.keys(config).forEach(subKey => {
                if (subKey === 'func') return;
                const inputs = this.el.querySelectorAll(`[data-param="${key}_${subKey}"]`);
                inputs.forEach(input => input.value = config[subKey]);
            });
        });

        // 3. Extra 幾何參數
        if (params.extra) {
            Object.keys(params.extra).forEach(key => {
                const inputs = this.el.querySelectorAll(`[data-param="${key}"]`);
                inputs.forEach(input => input.value = params.extra[key]);
            });
        }
    }

    // 從目前的 UI 抓取所有參數 (用於新增自定義)
    collectCurrentParams() {
        // 建立一個乾淨的數據結構
        const params = {
            color: this.el.querySelector('.color_preview').value,
            XH: {}, XS: {}, XV: {}, YH: {}, YS: {}, YV: {},
            extra: {}
        };

        // 抓取 6 組 HSV 數據
        ['XH','XS','XV','YH','YS','YV'].forEach(key => {
            params[key].func = this.el.querySelector(`select[data-param="${key}_func"]`).value;
            // 抓取該組下所有可能的數值 (value, range, lower, upper, height, step, top)
            const subKeys = ['value', 'range', 'lower', 'upper', 'height', 'step', 'top'];
            subKeys.forEach(subKey => {
                const input = this.el.querySelector(`input[data-param="${key}_${subKey}"]`);
                if (input) params[key][subKey] = parseInt(input.value);
            });
        });

        // 抓取 Extra 幾何數據
        const extraKeys = ['bladeCount', 'length', 'curvature', 'boxsize', 'position_fix', 'space', 'reverse'];
        extraKeys.forEach(key => {
            const input = this.el.querySelector(`input[data-param="${key}"]`);
            if (input) params.extra[key] = parseInt(input.value);
        });

        return params;
    }

    updateExtraGroups(assetID) {
        this.el.querySelectorAll('.extra_group').forEach(g => g.style.display = 'none');
        const config = {
            "MODES_SQUARE": ["boxsize"],
            "MODES_SICKLE": ["position_fix", "length", "curvature"],
            "MODES_FAN": ["bladeCount", "length", "curvature"],
            "MODES_BOXES": ["boxsize", "space"],
            "MODES_CMAP_DNA": ["reverse", "space"],
            "MODES_CMAP_FIRE": ["space"],
            "MODES_CMAP_LOVE": ["reverse", "space"],
            "MODES_MAP_ES": ["reverse", "space"],
            "MODES_MAP_ES_ZH": ["reverse", "space"],
            "MODES_MAP_ESXOPT": ["reverse", "space"],
            "MODES_CMAP_BENSON": ["reverse", "space"],
            "MODES_CMAP_YEN": ["reverse", "space"],
            "MODES_CMAP_GEAR": ["space"]
        };
        (config[assetID] || []).forEach(key => {
            const group = this.el.querySelector(`.extra_group[data-extra="${key}"]`);
            if (group) group.style.display = 'block';
        });
    }

    updateFunctionUI(selectEl) {
        const hsvBlock = selectEl.closest('.hsv_block');
        const funcName = selectEl.value;
        hsvBlock.querySelectorAll('.hsv_func_params').forEach(p => p.classList.remove('active'));
        const targetParams = hsvBlock.querySelector(`.hsv_func_params[data-func="${funcName}"]`);
        if (targetParams) targetParams.classList.add('active');
    }
}

// 主應用程式控制器
class LightPOVApp {
    constructor() {
        this.inspector = new Inspector();
        this.presetAssets = new Map();
        this.customAssets = new Map();
        this.isDirty = false;
        this.initLibrary();
        this.initGlobalEvents();
    }

    initLibrary() {
        const ASSET_ID_MAP = {
            "清除": "MODES_CLEAR", "純色": "MODES_PLAIN", "方形": "MODES_SQUARE",
            "鐮刀": "MODES_SICKLE", "扇形": "MODES_FAN", "方塊": "MODES_BOXES",
            "DNA": "MODES_CMAP_DNA", "火焰": "MODES_CMAP_FIRE", "Love": "MODES_CMAP_LOVE",
            "齒輪": "MODES_CMAP_GEAR", "ES": "MODES_MAP_ES", "工科": "MODES_MAP_ES_ZH",
            "ESXOPT": "MODES_MAP_ESXOPT", "OT": "MODES_CMAP_BENSON", "PT": "MODES_CMAP_YEN"
        };

        document.querySelectorAll('.preset .Asset_item').forEach(el => {
            const name = el.textContent.trim();
            const id = ASSET_ID_MAP[name];
            if (id) {
                const asset = new EffectAsset(id, name, 'preset');
                el.logic = asset;
                this.presetAssets.set(name, asset);
                el.addEventListener('click', () => this.selectAsset(el, asset));
            }
        });
    }

    selectAsset(element, asset) {
        document.querySelectorAll('.Asset_item').forEach(i => i.classList.remove('active'));
        element.classList.add('active');
        this.inspector.open(asset);
    }

    initGlobalEvents() {
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('hsv_func_select')) {
                this.inspector.updateFunctionUI(e.target);
                this.markDirty();
            }
        });

        document.querySelector('.btn_add_custom').addEventListener('click', () => {
            this.addNewCustomAsset();
        });
        // [左側] 素材庫分頁切換 (預設 / 自定義)
        document.querySelectorAll('.Asset_library_header .tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab; // 'preset' 或 'custom'
                
                // 1. 切換按鈕樣式
                document.querySelectorAll('.Asset_library_header .tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // 2. 切換內容顯示
                document.querySelectorAll('.Asset_library_content').forEach(content => {
                    content.classList.remove('active');
                    if (content.classList.contains(targetTab)) {
                        content.classList.add('active');
                    }
                });
            });
        });

        // [右側] 參數面板分頁切換 (參數 / 控制)
        document.querySelectorAll('.param_tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const mode = tab.dataset.mode; // 'param' 或 'control'
                const row1 = document.querySelector('.row1');

                // 1. 切換按鈕樣式
                document.querySelectorAll('.param_tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // 2. 切換內容顯示
                document.querySelectorAll('.param_body').forEach(body => {
                    body.classList.remove('active');
                    // 根據 HTML 結構中的 param_body--param 或 param_body--control 判斷
                    if (body.classList.contains(`param_body--${mode}`)) {
                        body.classList.add('active');
                    }
                });

                // 3. 連動版面縮放 (第一張圖提到的邏輯)
                if (mode === 'control') {
                    row1.classList.add('mode-control'); // 隱藏左側素材庫，放大控制面板
                } else {
                    row1.classList.remove('mode-control');
                }
            });
        });
        // 更新按鈕
        document.querySelector('.btn_update_custom').addEventListener('click', () => {
            const currentAsset = this.inspector.currentAsset;
            if (currentAsset && currentAsset.type === 'custom') {
                // 直接把目前 UI 的值蓋過原本物件的 params
                currentAsset.params = this.inspector.collectCurrentParams();
                alert(`「${currentAsset.displayName}」已更新！`);
                this.markDirty();
            }
        });

        // 刪除按鈕
        document.querySelector('.btn_delete_custom').addEventListener('click', () => {
            const currentAsset = this.inspector.currentAsset;
            if (currentAsset && currentAsset.type === 'custom') {
                if (confirm(`確定要刪除「${currentAsset.displayName}」嗎？`)) {
                    // 移除左側 HTML 元素
                    const items = document.querySelectorAll('.Asset_library_content.custom .Asset_item');
                    items.forEach(item => {
                        if (item.logic === currentAsset) item.remove();
                    });
                    this.inspector.resetToEmpty();
                }
            }
        });
    }

    addNewCustomAsset() {
        const currentAsset = this.inspector.currentAsset;
        if (!currentAsset) return;

        const name = prompt("請輸入自定義素材名稱:", `${currentAsset.displayName}_複製品`);
        if (!name) return;

        // 【重要】從 UI 抓取「現在畫面上調好的值」
        const currentUIParams = this.inspector.collectCurrentParams();

        const newAsset = new EffectAsset(currentAsset.id, name, 'custom', currentUIParams);
        
        this.renderAssetToLibrary(newAsset);
        document.querySelector('[data-tab="custom"]').click();
    }

    renderAssetToLibrary(asset) {
        const customContainer = document.querySelector('.Asset_library_content.custom');
        const el = document.createElement('div');
        el.className = 'Asset_item';
        el.textContent = asset.displayName;
        el.logic = asset; // 關聯物件

        // 綁定點擊事件
        el.addEventListener('click', () => {
            this.selectAsset(el, asset);
        });

        customContainer.appendChild(el);
    }

    markDirty() {
        this.isDirty = true;
        document.querySelector('.save_status').textContent = "● 編輯中...";
        // 這裡可以放 debounce 存檔邏輯
    }
}

window.app = new LightPOVApp();