namespace $ {

	export type $bog_rec_play_window = typeof globalThis & { $: $ }

	export type $bog_rec_play_config = {
		session: $bog_rec_session
	}

	/**
	 * Детерминированное проигрывание записанной сессии.
	 *
	 * Приложение поднимается тем же бандлом в изолированном фрейме, но с подменёнными
	 * часами, таймерами, случайностью, сетью и хранилищами. На выходе не видео,
	 * а живое приложение: его можно остановить, полистать состояние и продолжить.
	 *
	 * Перемотка назад делается пересборкой фрейма и быстрым проигрыванием вперёд —
	 * ровно потому, что проигрывание детерминировано, снимки состояния не нужны.
	 */
	export class $bog_rec_play extends $mol_object {

		readonly session!: $bog_rec_session

		id = $mol_guid()

		clock = new $bog_rec_clock

		rand = new $bog_rec_rand( 1 )

		views = new Map< string, $mol_view >()

		calls = new Map< string, $bog_rec_call[] >()

		/** Чего не нашлось при проигрывании: пропавшие виды и незаписанные запросы. */
		misses = [] as string[]

		cursor = 0

		rand_cursor = 0

		uuid_cursor = 0

		win = null as null | $bog_rec_play_window

		root = null as null | $mol_view

		hook_name() {
			return `__bog_rec_boot_${ this.id }`
		}

		/** Крючок в своём окне: фрейм зовёт его синхронно, до `DOMContentLoaded`. */
		@ $mol_mem
		hook() {

			const win = this.$.$mol_dom_context as unknown as Record< string, unknown >
			const name = this.hook_name()

			win[ name ] = ( frame: $bog_rec_play_window )=> this.boot( frame )

			return {
				destructor: ()=> { delete win[ name ] },
			}

		}

		escape( text: string ) {
			return text.replace( /&/g, '&amp;' ).replace( /</g, '&lt;' ).replace( /"/g, '&quot;' )
		}

		/**
		 * Документ фрейма. Встроенный скрипт стоит сразу за бандлом, поэтому успевает
		 * подменить окружение до того, как `$mol_view.auto()` смонтирует приложение.
		 */
		html( generation = 0 ) {

			const session = this.session
			const base = session.bundle.replace( /[^/]*$/, '' )

			return [
				'<!doctype html>',
				`<!-- ${ generation } -->`,
				'<html><head>',
				'<meta charset="utf-8"/>',
				`<base href="${ this.escape( base ) }"/>`,
				'<link href="web.css" rel="stylesheet"/>',
				'</head>',
				'<body style="margin:0">',
				`<div mol_view_root="${ this.escape( session.root ) }"></div>`,
				`<script src="${ this.escape( session.bundle ) }" charset="utf-8"></script>`,
				`<script>parent.${ this.hook_name() }( window )</script>`,
				'</body></html>',
			].join( '\n' )

		}

		boot( win: $bog_rec_play_window ) {
			this.win = win
			this.install_time( win )
			this.install_rand( win )
			this.install_net( win )
			this.install_state( win )
			this.install_hook( win )
		}

		install_time( win: $bog_rec_play_window ) {

			const clock = this.clock
			const started = this.session.started
			const native = win.Date

			win.Date = new Proxy( native, {
				construct( target, args ) {
					return args.length
						? Reflect.construct( target, args )
						: Reflect.construct( target, [ started + clock.now ] )
				},
				get( target, field, receiver ) {
					if( field === 'now' ) return ()=> started + clock.now
					return Reflect.get( target, field, receiver )
				},
			} )

			win.performance.now = ()=> clock.now

			/// Сигнатуры таймеров в браузере и в ноде расходятся, поэтому кладём их по имени
			const globals = win as unknown as Record< string, unknown >

			globals.setTimeout = ( task: unknown, delay?: number )=> {
				if( typeof task !== 'function' ) return 0
				return clock.plan( delay ?? 0, task as ()=> void )
			}

			globals.setInterval = ( task: unknown, delay?: number )=> {
				if( typeof task !== 'function' ) return 0
				const period = Math.max( 1, delay ?? 0 )
				const id = clock.reserve()
				const repeat = ()=> {
					( task as ()=> void )()
					clock.plan( period, repeat, id )
				}
				return clock.plan( period, repeat, id )
			}

			globals.clearTimeout = ( id?: number )=> clock.drop( id )
			globals.clearInterval = ( id?: number )=> clock.drop( id )

			globals.requestAnimationFrame = ( task: FrameRequestCallback )=> clock.plan( 16, ()=> task( clock.now ) )
			globals.cancelAnimationFrame = ( id?: number )=> clock.drop( id )

		}

		install_rand( win: $bog_rec_play_window ) {

			const session = this.session

			win.Math.random = ()=> {
				if( this.rand_cursor < session.rand.length ) return session.rand[ this.rand_cursor ++ ]
				return this.rand.next()
			}

			const crypto = win.crypto
			const native = crypto?.randomUUID?.bind( crypto )
			if( !native ) return

			crypto.randomUUID = ()=> {
				if( this.uuid_cursor >= session.uuid.length ) return native()
				return session.uuid[ this.uuid_cursor ++ ] as ReturnType< typeof native >
			}

		}

		install_net( win: $bog_rec_play_window ) {

			for( const call of this.session.calls ) {
				const bucket = this.calls.get( call.key )
				if( bucket ) bucket.push( call )
				else this.calls.set( call.key, [ call ] )
			}

			win.fetch = async ( input: RequestInfo | URL, init?: RequestInit )=> {

				const request = new win.Request( input, init )
				const key = await $bog_rec.key( request.clone() )
				const call = this.calls.get( key )?.shift()

				if( !call ) {
					this.misses.push( `Нет записи ответа: ${ key }` )
					return new win.Response( '{}', { status: 504 } )
				}

				const empty = [ 204, 205, 304 ].includes( call.status )

				return new win.Response( empty ? null : call.body, {
					status: call.status,
					headers: call.headers.map( ( [ name, value ] ): [ string, string ] => [ name, value ] ),
				} )

			}

		}

		install_state( win: $bog_rec_play_window ) {

			const context = win.$.$mol_view.$
			const session = this.session

			context.$mol_state_local[ 'native()' ] = this.storage( session.local )
			context.$mol_state_session[ 'native()' ] = this.storage( session.store )

			/// `about:srcdoc` глушит попытку переписать историю, но аргументы разбираются как обычно
			context.$mol_state_arg.href( 'about:srcdoc' + session.arg )

		}

		storage( dump: [ string, string ][] ) {

			const data = new Map( dump )

			return {
				getItem: ( key: string )=> data.has( key ) ? data.get( key )! : null,
				setItem: ( key: string, value: string )=> { data.set( key, value ) },
				removeItem: ( key: string )=> { data.delete( key ) },
			}

		}

		install_hook( win: $bog_rec_play_window ) {
			$bog_rec_hook.attach( win.$, {
				mount: view => { this.views.set( String( view ), view ) },
			} )
		}

		/** Ждёт, пока фрейм поднимется и подменит окружение. */
		async ready( timeout = 10000 ) {

			const limit = Date.now() + timeout

			while( !this.win ) {
				if( Date.now() > limit ) return $mol_fail( new Error( 'Фрейм не запустился' ) )
				await this.tick()
			}

			await this.settle()

			return this

		}

		/** Сколько событий уже проиграно. */
		progress() {
			return this.cursor
		}

		done() {
			return this.cursor >= this.session.events.length
		}

		/** Проиграть следующее событие. `false` — лог кончился. */
		step() {

			const events = this.session.events
			if( this.cursor >= events.length ) return false

			const entry = events[ this.cursor ++ ]
			this.clock.warp( entry.time )
			this.fire( entry )

			return true

		}

		fire( entry: $bog_rec_event ) {

			const view = this.views.get( entry.view )
			if( !view ) {
				this.misses.push( `Вид не найден: ${ entry.view }` )
				return
			}

			const node = view.dom_node()
			const data = entry.data

			if( data.value !== undefined && 'value' in node ) {
				( node as HTMLInputElement ).value = data.value
			}
			if( data.checked !== undefined && 'checked' in node ) {
				( node as HTMLInputElement ).checked = data.checked
			}

			node.dispatchEvent( this.event( entry ) )

		}

		event( entry: $bog_rec_event ) {

			const win = this.win
			if( !win ) return $mol_fail( new Error( 'Фрейм ещё не запущен' ) )

			const data = entry.data
			const base = {
				bubbles: true,
				cancelable: true,
				altKey: data.alt ?? false,
				ctrlKey: data.ctrl ?? false,
				shiftKey: data.shift ?? false,
				metaKey: data.meta ?? false,
			}

			if( data.key !== undefined ) {
				return new win.KeyboardEvent( entry.kind, { ... base, key: data.key, code: data.code } )
			}

			if( data.x !== undefined ) {
				return new win.MouseEvent( entry.kind, {
					... base,
					button: data.button ?? 0,
					clientX: data.x,
					clientY: data.y ?? 0,
				} )
			}

			return new win.Event( entry.kind, { bubbles: true, cancelable: true } )

		}

		/** Дать приложению доработать: микрозадачи, кадр, отложенные таймеры. */
		async settle( span = 32 ) {
			await this.tick()
			this.clock.warp( this.clock.now + span )
			await this.tick()
		}

		tick() {
			return new Promise< void >( done => {
				const timer = new this.$.$mol_after_timeout( 0, ()=> {
					timer.destructor()
					done()
				} )
			} )
		}

		/** Проиграть всё до указанного события включительно. */
		async seek( index: number ) {
			while( this.cursor < index && this.step() ) await this.settle()
		}

		/** Ошибки, которые приложение показало на экране. */
		errors() {

			const win = this.win
			if( !win ) return []

			const waiting = /^(Promise|.*wire.*)$/i
			const found = [] as string[]

			for( const node of win.document.querySelectorAll( '[mol_view_error]' ) ) {
				const kind = node.getAttribute( 'mol_view_error' ) ?? ''
				if( waiting.test( kind ) ) continue
				found.push( `${ node.localName }: ${ kind }` )
			}

			return found

		}

		/** Сбросить проигрывание. Фрейм пересоздаёт хозяин. */
		reset() {
			this.clock = new $bog_rec_clock
			this.rand = new $bog_rec_rand( 1 )
			this.views = new Map
			this.calls = new Map
			this.misses = []
			this.cursor = 0
			this.rand_cursor = 0
			this.uuid_cursor = 0
			this.win = null
			this.root = null
		}

	}

}
