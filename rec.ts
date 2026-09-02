namespace $ {

	/** Выжимка из DOM-события, достаточная, чтобы собрать его заново. */
	export type $bog_rec_data = {
		key?: string
		code?: string
		alt?: boolean
		ctrl?: boolean
		shift?: boolean
		meta?: boolean
		button?: number
		x?: number
		y?: number
		value?: string
		checked?: boolean
	}

	/** Одно воздействие пользователя на приложение. */
	export type $bog_rec_event = {
		/** Смещение от старта сессии, мс. */
		time: number
		/** Путь вида, вроде `Root<0>.Menu<>.Row<"2">` с именем корневого класса впереди. */
		view: string
		/** Имя DOM-события. */
		kind: string
		data: $bog_rec_data
	}

	/** Ответ бэка, сохранённый, чтобы при проигрывании не ходить в сеть. */
	export type $bog_rec_call = {
		key: string
		status: number
		headers: [ string, string ][]
		body: string
	}

	/** Слепок сессии: всё, из чего приложение собирается заново. */
	export type $bog_rec_session = {
		version: 1
		id: string
		/** Адрес бандла, которым сессия записана. Проигрывать можно только им. */
		bundle: string
		/** Имя корневого класса вида. */
		root: string
		/** Момент старта, epoch ms. */
		started: number
		/** Хвост адреса на момент старта, вида `#!page=home`. */
		arg: string
		/** Язык документа, чтобы фрейм выглядел как оригинал. */
		lang: string
		/** Значение `mol_theme` у корня документа. */
		theme: string
		viewport: [ number, number ]
		local: [ string, string ][]
		store: [ string, string ][]
		/** Лента значений `Math.random` в порядке вызова. */
		rand: number[]
		/** Лента значений `crypto.randomUUID` в порядке вызова. */
		uuid: string[]
		calls: $bog_rec_call[]
		events: $bog_rec_event[]
	}

	/** Формат записи сессии и утилиты вокруг него. */
	export class $bog_rec extends $mol_object {

		/** Ключ, по которому запрос сопоставляется с записанным ответом. */
		static async key( request: Request ) {
			const method = request.method.toUpperCase()
			const body = ( method === 'GET' || method === 'HEAD' ) ? '' : await request.text()
			return `${ method } ${ request.url } ${ body }`
		}

		static text( session: $bog_rec_session ) {
			return JSON.stringify( session, null, '\t' )
		}

		static parse( text: string ): $bog_rec_session {
			const session = JSON.parse( text ) as $bog_rec_session
			if( session?.version !== 1 ) {
				return $mol_fail( new Error( `Не похоже на запись сессии` ) )
			}
			return session
		}

		/** Длительность сессии, мс. */
		static duration( session: $bog_rec_session ) {
			const events = session.events
			return events.length ? events[ events.length - 1 ].time : 0
		}

		/** Пустая сессия, от которой отталкиваются рекордер и фаззер. */
		static blank( root: string, bundle: string ): $bog_rec_session {
			return {
				version: 1,
				id: $mol_guid(),
				bundle,
				root,
				started: Date.now(),
				arg: '',
				lang: '',
				theme: '',
				viewport: [ 0, 0 ],
				local: [],
				store: [],
				rand: [],
				uuid: [],
				calls: [],
				events: [],
			}
		}

	}

}
