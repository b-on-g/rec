namespace $ {

	export type $bog_rec_fuzz_config = {
		/** Корень обхода. Обычно `$mol_view.Root(0)`. */
		root: $mol_view
		steps?: number
		seed?: number
		/** Вернуть `false`, чтобы вид не трогали. */
		allow?: ( view: $mol_view )=> boolean
		/** Что печатать в поля ввода. */
		words?: readonly string[]
	}

	export type $bog_rec_fuzz_report = {
		session: $bog_rec_session | null
		steps: number
		errors: string[]
	}

	/**
	 * Прокликиватель без Playwright.
	 *
	 * Обходит дерево видов, берёт у каждого его `event()` и дёргает обработчики так,
	 * как это делал бы человек. Ни селекторов, ни разметки для тестов не нужно:
	 * у каждого вида уже есть путь и объявленный список событий.
	 *
	 * Работает в паре с `$bog_rec_take`, поэтому упавший прогон оставляет после себя
	 * готовую запись, которую `$bog_rec_play` проиграет столько раз, сколько надо.
	 */
	export class $bog_rec_fuzz extends $mol_object {

		/** Виды, которые трогать нельзя: открывают диалоги и уводят со страницы. */
		static skip = [ '$mol_button_open_native' ]

		static win() {
			return $mol_dom_context
		}

		/** Видимые виды, у которых есть хоть один обработчик. */
		static targets( root: $mol_view, allow?: ( view: $mol_view )=> boolean ) {

			const found = [] as $mol_view[]
			const seen = new Set< $mol_view >()

			const walk = ( view: $mol_view )=> {

				if( seen.has( view ) ) return
				seen.add( view )

				const node = $mol_wire_probe( ()=> view.dom_node() )

				if( node?.isConnected && this.suits( view, allow ) ) found.push( view )

				const sub = $mol_wire_probe( ()=> view.sub_visible() ) ?? []
				for( const child of sub ) {
					if( child instanceof $mol_view ) walk( child )
				}

			}

			walk( root )

			return found

		}

		static suits( view: $mol_view, allow?: ( view: $mol_view )=> boolean ) {
			if( this.skip.includes( view.constructor.name ) ) return false
			if( allow && !allow( view ) ) return false
			return this.kinds( view ).length > 0
		}

		static kinds( view: $mol_view ) {
			try {
				return Object.keys( view.event() )
			} catch( error ) {
				$mol_fail_log( error )
				return []
			}
		}

		/** Ошибки, которые приложение показало на экране. */
		static errors( root: $mol_view ) {

			const node = $mol_wire_probe( ()=> root.dom_node() )
			if( !node ) return []

			const waiting = /^(Promise|.*wire.*)$/i
			const found = [] as string[]

			for( const kid of node.querySelectorAll( '[mol_view_error]' ) ) {
				const kind = kid.getAttribute( 'mol_view_error' ) ?? ''
				if( waiting.test( kind ) ) continue
				found.push( `${ kid.localName }: ${ kind }` )
			}

			return found

		}

		static async run( config: $bog_rec_fuzz_config ): Promise< $bog_rec_fuzz_report > {

			const rand = new $bog_rec_rand( config.seed ?? 1 )
			const limit = config.steps ?? 100
			const errors = [] as string[]

			$bog_rec_take.start()

			let steps = 0

			for( ; steps < limit; ++ steps ) {

				const targets = this.targets( config.root, config.allow )
				if( !targets.length ) break

				const view = rand.pick( targets )
				const kinds = this.kinds( view )
				if( !kinds.length ) continue

				this.fire( view, rand.pick( kinds ), rand, config )

				await this.settle()

				const found = this.errors( config.root )
				if( found.length ) {
					errors.push( ... found )
					break
				}

			}

			return {
				session: $bog_rec_take.stop(),
				steps,
				errors,
			}

		}

		static fire(
			view: $mol_view,
			kind: string,
			rand: $bog_rec_rand,
			config: $bog_rec_fuzz_config,
		) {

			const win = this.win()
			const node = view.dom_node()

			if( node instanceof win.HTMLInputElement || node instanceof win.HTMLTextAreaElement ) {
				const words = config.words ?? [ '', 'а', 'тест', '0', '-1', '  ', '<b>' ]
				node.value = rand.pick( words )
			}

			node.dispatchEvent( this.event( win, kind, rand ) )

		}

		static event( win: typeof globalThis, kind: string, rand: $bog_rec_rand ) {

			const base = { bubbles: true, cancelable: true }

			if( /^key/.test( kind ) ) {
				const keys = [ 'Enter', 'Escape', 'Backspace', 'ArrowDown', 'ArrowUp', 'a' ]
				return new win.KeyboardEvent( kind, { ... base, key: rand.pick( keys ) } )
			}

			if( /^(click|dbl|mouse|pointer|context)/.test( kind ) ) {
				return new win.MouseEvent( kind, { ... base, button: 0, clientX: 0, clientY: 0 } )
			}

			return new win.Event( kind, base )

		}

		static settle() {
			return new Promise< void >( done => {
				const timer = new this.$.$mol_after_timeout( 16, ()=> {
					timer.destructor()
					done()
				} )
			} )
		}

	}

}
