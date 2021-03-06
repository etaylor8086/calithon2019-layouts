(function () {
	'use strict';

	const checklist = nodecg.Replicant('checklist');

	class GdqChecklist extends Polymer.MutableData(Polymer.Element) {
		static get is() {
			return 'gdq-checklist';
		}

		static get properties() {
			return {
				stageTechDuties: Array,
				extraContent: Array,
				audioReady: Boolean,
				techStationDuties: Array,
				recordingsCycled: Boolean
			};
		}

		ready() {
			super.ready();
			checklist.on('change', newVal => {
				this.extraContent = newVal.extraContent;
				this.techStationDuties = newVal.techStationDuties;
        this.stageTechDuties = newVal.stageTechDuties;
				this.audioEngineerDuties = newVal.audioEngineerDuties;
				this.audioReady = newVal.audioEngineerDuties.every(task => task.complete);
				this.recordingsCycled = newVal.special.find(task => task.name === 'Cycle Recordings').complete;
			});

			this._checkboxChanged = this._checkboxChanged.bind(this);
			this.addEventListener('change', this._checkboxChanged);
      this.audioEngineer = nodecg.bundleConfig.techDashboardShowAudioEngineer;
		}

		_checkboxChanged(e) {
			const target = e.path[0];
			const category = target.getAttribute('category');
			const name = target.hasAttribute('name') ? target.getAttribute('name') : target.innerText.trim();
			checklist.value[category].find(task => {
				if (task.name === name) {
					task.complete = target.checked;
					return true;
				}

				return false;
			});
		}
	}

	customElements.define(GdqChecklist.is, GdqChecklist);
})();
