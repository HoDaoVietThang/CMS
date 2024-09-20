<?php
/**
 * The base configuration for WordPress
 *
 * The wp-config.php creation script uses this file during the installation.
 * You don't have to use the website, you can copy this file to "wp-config.php"
 * and fill in the values.
 *
 * This file contains the following configurations:
 *
 * * Database settings
 * * Secret keys
 * * Database table prefix
 * * ABSPATH
 *
 * @link https://developer.wordpress.org/advanced-administration/wordpress/wp-config/
 *
 * @package WordPress
 */

// ** Database settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define( 'DB_NAME', 'wordpress' );

/** Database username */
define( 'DB_USER', 'root' );

/** Database password */
define( 'DB_PASSWORD', '' );

/** Database hostname */
define( 'DB_HOST', 'localhost' );

/** Database charset to use in creating database tables. */
define( 'DB_CHARSET', 'utf8mb4' );

/** The database collate type. Don't change this if in doubt. */
define( 'DB_COLLATE', '' );

/**#@+
 * Authentication unique keys and salts.
 *
 * Change these to different unique phrases! You can generate these using
 * the {@link https://api.wordpress.org/secret-key/1.1/salt/ WordPress.org secret-key service}.
 *
 * You can change these at any point in time to invalidate all existing cookies.
 * This will force all users to have to log in again.
 *
 * @since 2.6.0
 */
define( 'AUTH_KEY',         ';,yZLU@Da!az;f>96+@-6&,*WS`{lN%aEm^S!uNHu3&MM?f)!DXTeQiO}.lmDWE9' );
define( 'SECURE_AUTH_KEY',  'I&`5>u<]^_hPy!xuH?xPNGVc,@/@<ew|PxQ2+yb*A51obE*rf,G6z6&Xj.j^g%+l' );
define( 'LOGGED_IN_KEY',    ')-*g}F{yxy<zh/a9!+OU5)2)!8>;+.+87=p(CkDl+Fw*!dVHy__^V,abFeQTS(j@' );
define( 'NONCE_KEY',        ';;~$)j5m8hqhTz-Ghy*+j- CE?M4}ZcRu!6CfHR{X*q&{6xi].:!<[X0H8,ZW4F$' );
define( 'AUTH_SALT',        'L(E%%fg}q|Mx%WFTjKzWXx2psV2le=.Ex`g.<5l7ZkDyPF)90F^kSG1>p}d?4+R>' );
define( 'SECURE_AUTH_SALT', 'ZZ7S]=((DU3=b^?ro[q37azQ:i~N~W!KT$I/q!R}GY{<=Q~jB*n&| Y&Nj2zqN0t' );
define( 'LOGGED_IN_SALT',   'zB{q.#lAX~xc7x,t-_!(G1MMa3.m}`Xk&- /ESop~G7vP6-WauK7FJ`yQ{CdmL>R' );
define( 'NONCE_SALT',       'b+!WHjtEC@I]oR}+m8n%_7_-n2-A,-4gWg 2!zFcj(J]H3%W? mJ&},*Vj}bo{D`' );

/**#@-*/

/**
 * WordPress database table prefix.
 *
 * You can have multiple installations in one database if you give each
 * a unique prefix. Only numbers, letters, and underscores please!
 */
$table_prefix = 'wp_';

/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 *
 * For information on other constants that can be used for debugging,
 * visit the documentation.
 *
 * @link https://developer.wordpress.org/advanced-administration/debug/debug-wordpress/
 */
define( 'WP_DEBUG', false );

/* Add any custom values between this line and the "stop editing" line. */



/* That's all, stop editing! Happy publishing. */

/** Absolute path to the WordPress directory. */
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';
