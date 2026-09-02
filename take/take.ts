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
		/** Держать запись в `localStorage`, чтобы она пережила перезагрузку и падение. */
		keep?: boolean
		/** Куда слать запись при уходе со страницы. */
		sink?: string
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

		/** Родной `fetch`, чтобы отправка записи не попадала в саму запись. */
		static fetch_orig = null as null | typeof globalThis.fetch

		/** Что вернуть на место при остановке. */
		static restore = [] as ( ()=> void )[]

		/** Последняя остановленная сессия: её ещё можно забрать после `stop()`. */
		static last = null as null | $bog_rec_session

		static store_key = 'bog_rec_session'

		static config_key = 'bog_rec_config'

		static win() {
			return $mol_dom_context
		}

		/** Адрес бандла, которым сейчас исполняется приложение. */
		static bundle() {
			const doc = this.win().document
			const scripts = [ ... doc.querySelectorAll( 'script[src]' ) ] as HTMLScriptElement[]
			const found = scripts.find( script => /web\.js(\?|$)/.test( script.src ) )
			if( found ) return found.src
			try {
				return new URL( 'web.js', doc.baseURI ).toString()
			} catch {
				return ''
			}
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
			session.lang = win.document.documentElement.lang
			session.theme = win.document.documentElement.getAttribute( 'mol_theme' ) ?? ''
			session.viewport = [ win.innerWidth, win.innerHeight ]
			session.local = this.dump( win.localStorage, session.root )
			session.store = this.dump( win.sessionStorage, session.root )

			this.session = session

			this.detach = $bog_rec_hook.attach( this.$, {
				event: ( view, kind, event )=> this.put( view, kind, event ),
			} )

			this.wrap_rand( win )
			this.wrap_net( win )
			this.watch( win )

			return session

		}

		/** Останавливает запись, снимает подмены и отдаёт сессию. */
		static stop() {

			const session = this.session
			this.session = null
			this.last = session

			this.detach?.()
			this.detach = null

			for( const back of this.restore.splice( 0 ) ) back()
			this.fetch_orig = null

			return session

		}

		/** Текущая или последняя записанная сессия. */
		static current() {
			return this.session ?? this.last
		}

		/** JSON записи. Обычно вызывается из консоли. */
		static text( session = this.current() ) {
			if( !session ) return $mol_fail( new Error( 'Запись не найдена' ) )
			return $bog_rec.text( session )
		}

		/**
		 * Скачивает запись файлом. Вызывается ИЗ КОНСОЛИ, кнопки в приложении нет и не будет:
		 * рекордер не имеет права подмешивать свой интерфейс в чужое приложение.
		 */
		static save( session = this.current() ) {

			if( !session ) return $mol_fail( new Error( 'Запись не найдена' ) )

			const doc = this.win().document
			const blob = new Blob([ $bog_rec.text( session ) ], { type: 'application/json' })
			const uri = URL.createObjectURL( blob )

			const link = doc.createElement( 'a' )
			link.href = uri
			link.download = `${ session.root }-${ session.id }.rec.json`
			link.click()

			URL.revokeObjectURL( uri )

			return session.events.length

		}

		/**
		 * Взводит автосброс так, чтобы он пережил перезагрузку: настройки ложатся
		 * в `localStorage`, откуда их читает автозапуск при следующей загрузке.
		 * Функции сюда не кладут, только простые значения.
		 */
		static arm( config: Pick< $bog_rec_take_config, 'keep' | 'sink' | 'calls' > = { keep: true } ) {
			this.win().localStorage?.setItem( this.config_key, JSON.stringify( config ) )
			Object.assign( this.config, config )
			return config
		}

		/** Снимает взвод. */
		static disarm() {
			this.win().localStorage?.removeItem( this.config_key )
		}

		/** Настройки, оставленные для следующей загрузки. */
		static armed(): $bog_rec_take_config {
			const text = this.win().localStorage?.getItem( this.config_key )
			if( !text ) return {}
			try {
				return JSON.parse( text ) as $bog_rec_take_config
			} catch( error ) {
				$mol_fail_log( error )
				return {}
			}
		}

		/** Кладёт запись в `localStorage`, чтобы она пережила перезагрузку. */
		static store( session = this.current() ) {
			if( !session ) return
			try {
				this.win().localStorage?.setItem( this.store_key, $bog_rec.text( session ) )
			} catch( error ) {
				$mol_fail_log( error )
			}
		}

		/** Достаёт отложенную запись. */
		static stored() {
			const text = this.win().localStorage?.getItem( this.store_key )
			return text ? $bog_rec.parse( text ) : null
		}

		static forget() {
			this.win().localStorage?.removeItem( this.store_key )
		}

		/** Отправляет запись на приёмник. Идёт мимо собственной обёртки, чтобы не писать саму себя. */
		static send( url: string, session = this.current() ) {

			if( !session ) return

			const native = this.fetch_orig ?? this.win().fetch

			native( url, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: $bog_rec.text( session ),
				keepalive: true,
			} ).catch( error => $mol_fail_log( error ) )

		}

		/** Сбрасывает запись туда, куда просили в настройках. */
		static flush() {
			if( !this.session ) return
			if( this.config.keep ) this.store()
			if( this.config.sink ) this.send( this.config.sink )
		}

		/** Уход со страницы — последний момент, когда запись ещё можно спасти. */
		static watch( win: typeof globalThis ) {

			if( typeof win.addEventListener !== 'function' ) return

			win.addEventListener( 'pagehide', ()=> this.flush() )

			win.addEventListener( 'visibilitychange', ()=> {
				if( win.document.visibilityState === 'hidden' ) this.flush()
			} )

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
			/// Свои ключи не берём никогда, иначе с `keep` запись вложится сама в себя
			if( key === this.store_key || key === this.config_key ) return false
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

			if( typeof win.Math?.random !== 'function' ) return

			const rand = win.Math.random.bind( win.Math )
			this.restore.push( ()=> { win.Math.random = rand } )

			win.Math.random = ()=> {
				const value = rand()
				this.session?.rand.push( value )
				return value
			}

			const crypto = win.crypto
			const uuid = crypto?.randomUUID?.bind( crypto )
			if( !uuid ) return

			this.restore.push( ()=> { crypto.randomUUID = uuid } )

			crypto.randomUUID = ()=> {
				const value = uuid()
				this.session?.uuid.push( value )
				return value
			}

		}

		static wrap_net( win: typeof globalThis ) {

			/// Рекордер не имеет права ронять хозяина, а окружение бывает и без сети
			if( typeof win.fetch !== 'function' ) return

			const native = win.fetch.bind( win )
			this.fetch_orig = native
			this.restore.push( ()=> { win.fetch = native } )

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
