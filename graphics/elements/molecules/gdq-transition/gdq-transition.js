(function () {
	'use strict';

	const MEDIA_READY_STATES = {
		HAVE_NOTHING: 0,
		HAVE_METADATA: 1,
		HAVE_CURRENT_DATA: 2,
		HAVE_FUTURE_DATA: 3,
		HAVE_ENOUGH_DATA: 4
	};

	CustomEase.create('ModifiedPower2EaseInOut', 'M0,0 C0.66,0 0.339,1 1,1');

	/**
	 * @customElement
	 * @polymer
	 */
	class GdqTransition extends Polymer.Element {
		static get is() {
			return 'gdq-transition';
		}

		static get properties() {
			return {};
		}

		ready() {
			super.ready();

			const videos = Array.from(this.shadowRoot.querySelectorAll('video'));
			const videoLoadPromises = videos.map(this.waitForVideoToLoad);
			Promise.all(videoLoadPromises).then(() => this.init());
		}

		init() {
			console.log('init. screenshot testing?', window.__SCREENSHOT_TESTING__);
			if (this._initialized) {
				throw new Error('already initialized');
			}
			this._initialized = true;
			this.dispatchEvent(new CustomEvent('initialized'));

			if (window.__SCREENSHOT_TESTING__) {
				this.shadowRoot.querySelectorAll('video').forEach(video => {
					video.currentTime = video.duration;
				});
			} else {
				// TODO: remove this when done developing this particular animation.
				const fromClosedToBreak = this.fromClosedToBreak();
				const fromBreakToClosed = this.fromClosedToBreak().reverse(0);
				const tl = new TimelineMax({repeat: -1});
				tl.add(fromClosedToBreak, '+=4');
				tl.add(fromBreakToClosed, '+=4');
			}
		}

		waitForInit() {
			return new Promise(resolve => {
				if (this._initialized) {
					return resolve();
				}

				this.addEventListener('initialized', () => {
					resolve();
				}, {once: true, passive: true});
			});
		}

		waitForVideoToLoad(videoElem) {
			return new Promise(resolve => {
				if (videoElem.readyState >= MEDIA_READY_STATES.HAVE_ENOUGH_DATA) {
					return resolve();
				}

				videoElem.addEventListener('canplaythrough', () => {
					resolve();
				}, {once: true, passive: true});
			});
		}

		fromClosedToBreak() {
			const tl = new TimelineLite();

			// Start frame = 211

			tl.addLabel('frontRects', 0);
			tl.addLabel('frontTraps', 0.1);
			tl.addLabel('backRects', 0.1667);
			tl.addLabel('backTraps', 0.2334);

			// Front rects.
			tl.to([this.$.bottomFrontRect, this.$.bottomRectAnimation], 0.2167, {
				x: 26,
				y: 321,
				ease: 'ModifiedPower2EaseInOut'
			}, 'frontRects');
			tl.to([this.$.topFrontRect, this.$.topRectAnimation], 0.2167, {
				x: -10,
				y: -349,
				ease: 'ModifiedPower2EaseInOut'
			}, 'frontRects');

			// Front traps.
			tl.to([this.$.bottomFrontTrapezoid, this.$.bottomTrapAnimation], 0.2667, {
				x: -503,
				y: 364,
				ease: 'ModifiedPower2EaseInOut'
			}, 'frontTraps');

			tl.call(() => {
				if (!window.__SCREENSHOT_TESTING__) {
					this.$.bottomTrapAnimation.play();
					this.$.bottomRectAnimation.play();
					this.$.topTrapAnimation.play();
					this.$.topRectAnimation.play();
				}
			}, null, null, 'frontRects');

			tl.to([this.$.topFrontTrapezoid, this.$.topTrapAnimation], 0.2667, {
				x: 8,
				y: -417,
				ease: 'ModifiedPower2EaseInOut'
			}, 'frontTraps');

			// Back rects.
			tl.to(this.$.bottomBackRect, 0.2334, {
				x: 0,
				y: 323,
				ease: 'ModifiedPower2EaseInOut'
			}, 'backRects');
			tl.to(this.$.topBackRect, 0.2334, {
				x: 0,
				y: -351,
				ease: 'ModifiedPower2EaseInOut'
			}, 'backRects');

			// Back traps.
			tl.to(this.$.bottomBackTrapezoid, 0.2334, {
				x: -490,
				y: 374,
				ease: 'ModifiedPower2EaseInOut'
			}, 'backTraps');
			tl.to(this.$.topBackTrapezoid, 0.2334, {
				x: 0,
				y: -426,
				ease: 'ModifiedPower2EaseInOut'
			}, 'backTraps');

			return tl;
		}
	}

	customElements.define(GdqTransition.is, GdqTransition);
})();
