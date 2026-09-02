namespace $ {

	/**
	 * Детерминированный ГПСЧ (xorshift32).
	 * Нужен фаззеру и подстраховывает плеер, когда лента записанных значений кончилась.
	 */
	export class $bog_rec_rand extends $mol_object2 {

		state: number

		constructor( seed = 1 ) {
			super()
			this.state = ( seed | 0 ) || 1
		}

		/** Следующее число в полуинтервале [0, 1). */
		next() {
			let x = this.state | 0
			x ^= x << 13
			x |= 0
			x ^= x >>> 17
			x ^= x << 5
			x |= 0
			this.state = x || 1
			return ( x >>> 0 ) / 0x1_0000_0000
		}

		/** Целое в полуинтервале [0, limit). */
		below( limit: number ) {
			return Math.floor( this.next() * limit )
		}

		/** Случайный элемент непустого списка. */
		pick< Item >( items: readonly Item[] ) {
			return items[ this.below( items.length ) ]
		}

	}

}
