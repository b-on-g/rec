namespace $ {

	export type $bog_rec_take_config = {
		/** Имя корневого класса вида. По умолчанию берётся из `[mol_view_root]`. */
		root?: string
		/** Адрес бандла. По умолчанию берётся из тега `<script>`. */
		bundle?: string
		/** Вернуть `true` для путей, значения которых писать нельзя. */
		mask?: ( view: string )=> boolean
		/** Писать ли тела ответов бэка. По умолчанию да. */
		calls?: boolean
		/** Какие ключи хранилищ попадают в запись. По умолчанию чужие приложения отсеиваются. */
		keys?: ( key: string )=> boolean
	}

	/**
	 * Рекордер: пишет не картинку, а вход приложения.
	 *
	 * События, ответы бэка, стартовые хранилища, адрес, размер окна и ленты
	 * недетерминированных значений. Этого хватает, чтобы `$bog_rec_play`
	 * собрал тот же сеанс заново.
	 */
	export class $bog_rec_take extends $mol_object {

		static session = null as null | $bog_rec_session

		static config = {} as $bog_rec_take_config

		static detach = null as null | ( ()=> void )

		static win() {
			return $mol_dom_context
		}

		/** Адрес бандла, которым сейчас исполняется приложение. */
		static bundle() {
			const doc = this.win().document
			const scripts = [ ... doc.querySelectorAll( 'script[src]' ) ] as HTMLScriptElement[]
			const found = scripts.find( script => /web\.js(\?|$)/.test( script.src ) )
			return found?.src ?? new URL( 'web.js', doc.baseURI ).toString()
		}

		/** Имя корневого класса вида, объявленное в разметке. */
		static root() {
			const node = this.win().document.querySelector( '[mol_view_root]:not([mol_view_root=""])' )
			return node?.getAttribute( 'mol_view_root' ) ?? ''
		}

		static started() {
			return Boolean( this.session )
		}

		static start( config: $bog_rec_take_config = {} ) {

			if( this.session ) return this.session

			const win = this.win()
			this.config = config

			const session = $bog_rec.blank(
				config.root ?? this.root(),
				config.bundle ?? this.bundle(),
			)

			session.arg = win.location.hash
			session.viewport = [ win.innerWidth, win.innerHeight ]
			session.local = this.dump( win.localStorage, session.root )
			session.store = this.dump( win.sessionStorage, session.root )

			this.session = session

			this.detach = $bog_rec_hook.attach( this.$, {
				event: ( view, kind, event )=> this.put( view, kind, event ),
			} )

			this.wrap_rand( win )
			this.wrap_net( win )

			return session

		}

		/** Останавливает запись и отдаёт сессию. */
		static stop() {
			const session = this.session
			this.session = null
			this.detach?.()
			this.detach = null
			return session
		}

		static dump( native: Storage | null, root: string ) {

			const dump = [] as [ string, string ][]
			if( !native ) return dump

			for( let index = 0; index < native.length; ++ index ) {
				const key = native.key( index )
				if( key === null ) continue
				if( !this.suits( key, root ) ) continue
				dump.push([ key, native.getItem( key ) ?? '' ])
			}

			return dump

		}

		/**
		 * На общем origin (тот же дев-сервер) в хранилище лежит состояние всех приложений
		 * воркспейса. Ключи чужих корней, разобранные по путям видов, в запись не попадают.
		 */
		static suits( key: string, root: string ) {
			const filter = this.config.keys
			if( filter ) return filter( key )
			if( key.startsWith( root ) ) return true
			return !/^\$\w+\.Root</.test( key )
		}

		static put( view: $mol_view, kind: string, event: Event ) {

			const session = this.session
			if( !session ) return

			const path = String( view )

			session.events.push({
				time: Date.now() - session.started,
				view: path,
				kind,
				data: this.data( path, event ),
			})

		}

		static data( path: string, event: Event ) {

			const win = this.win()
			const data = {} as $bog_rec_data

			if( event instanceof win.UIEvent ) {
				const source = event as KeyboardEvent & MouseEvent
				data.alt = source.altKey
				data.ctrl = source.ctrlKey
				data.shift = source.shiftKey
				data.meta = source.metaKey
			}

			if( event instanceof win.KeyboardEvent ) {
				data.key = event.key
				data.code = event.code
			}

			if( event instanceof win.MouseEvent ) {
				data.button = event.button
				data.x = event.clientX
				data.y = event.clientY
			}

			const target = event.target
			if( target instanceof win.HTMLInputElement || target instanceof win.HTMLTextAreaElement ) {
				data.value = this.value( path, target )
			}
			if( target instanceof win.HTMLInputElement && ( target.type === 'checkbox' || target.type === 'radio' ) ) {
				data.checked = target.checked
			}

			return data

		}

		/**
		 * Значения полей пишутся как есть, иначе реплей уедет.
		 * Пароли не пишутся никогда, остальное закрывается через `mask` в настройках.
		 */
		static value( path: string, target: HTMLInputElement | HTMLTextAreaElement ) {
			const secret = ( target instanceof this.win().HTMLInputElement && target.type === 'password' )
				|| Boolean( this.config.mask?.( path ) )
			return secret ? '•'.repeat( target.value.length ) : target.value
		}

		static wrap_rand( win: typeof globalThis ) {

			const rand = win.Math.random.bind( win.Math )
			win.Math.random = ()=> {
				const value = rand()
				this.session?.rand.push( value )
				return value
			}

			const crypto = win.crypto
			const uuid = crypto?.randomUUID?.bind( crypto )
			if( !uuid ) return

			crypto.randomUUID = ()=> {
				const value = uuid()
				this.session?.uuid.push( value )
				return value
			}

		}

		static wrap_net( win: typeof globalThis ) {

			const native = win.fetch.bind( win )

			win.fetch = async ( input: RequestInfo | URL, init?: RequestInit )=> {

				const request = new win.Request( input, init )
				const key = await $bog_rec.key( request.clone() )
				const response = await native( request )

				const session = this.session
				if( !session || this.config.calls === false ) return response

				try {
					const copy = response.clone()
					const headers = [] as [ string, string ][]
					copy.headers.forEach( ( value, name )=> headers.push([ name, value ]) )
					session.calls.push({
						key,
						status: copy.status,
						headers,
						body: await copy.text(),
					})
				} catch( error ) {
					$mol_fail_log( error )
				}

				return response

			}

		}

	}

}
