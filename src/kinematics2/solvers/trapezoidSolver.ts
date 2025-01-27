// #region IMPORTS
import type { IKChain, IKLink } from '../IKChain';
import type Pose        from '../../armature/Pose';
import type IKTarget    from '../IKTarget';

import Vec3             from '../../maths/Vec3';
import Quat             from '../../maths/Quat';
import Transform        from '../../maths/Transform';
// #endregion


// eslint-disable-next-line @typescript-eslint/no-unused-vars
function trapezoidSolverX( tar: IKTarget, chain: IKChain, pose: Pose, debug: any ){
    console.log( 'trapezoid' );

    debug.ln.add( tar.startPos, tar.endPos, 0x00ff00 );
    debug.pnt.add( tar.startPos, 0x00ff00, 6 );
    debug.pnt.add( tar.endPos, 0x00ff00, 6 );

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    const ptran = new Transform(); // Parent Bone WS Transform
    const ctran = new Transform(); // Current Bone WS Transform
    let lnk : IKLink;

    // Axis of rotation after LookSolver aligns chain to target
    const axis  = new Vec3().fromCross( tar.twist, tar.swing ).norm();
    const rot   = new Quat();

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    //       Short Side
    //    b  /---------\ c
    //      /           \
    //   a /_____________\ d
    //        Long Side
    //
    //  Bone0=AB, Bone1=BC, Bone2=CD, IK DISTANCE=AD

    const lft_len   = chain.links[0].len;
    const top_len   = chain.links[1].len;
    const rit_len   = chain.links[2].len;
    const bot_len   = tar.dist;
    let ang         : Array< number > | null;

    console.log( "LENGTHS", lft_len, top_len, rit_len, bot_len );

    // NOTE : If bot + top are = calc fails, But if they're equal,
    // then it makes a rect with all angles being 90 Degrees
    // so if it becomes an issue thats a way to fix it. Might also have to
    // check that bone 0 and 2 are equal lengths for the 90 degree fix.
    // But things do work if legs are not the same length. The shortest bone will
    // determine how fast the trapezoid collapses not sure how to compute that
    // yet other then letting the calculator give back null when the dimensions aren't possible.
    if( bot_len >= top_len ){
        console.log( 'IK LONGER');

        console.log( calculateTrapezoidAngles( lft_len, top_len, rit_len, bot_len ) );

        ang = trapezoidCalculator( bot_len, top_len, lft_len, rit_len ); // IK distance longer then middle bone
        if( !ang ) return;
    }else{
        console.log( 'IK SHORTER')
        ang = trapezoidCalculator( top_len, bot_len, rit_len, lft_len ); // Middle bone is longer then ik distance
        if( !ang ) return;

        // Since we need to do the computation in reverse to make sure the shortest base it top, longest is bottom
        // Changing the top/bottom changes the order that the rotation values come back.
        // Easy to fix by reordering the array to match what it would be if the IK line is the longer one
        ang = [ ang[ 2 ], ang[ 3 ], ang[ 0 ], ang[ 1 ] ]; // abcd -> cdab
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // FIRST BONE

    // Get Bone's current rotation
    lnk = chain.links[0];
    pose.getWorldTransform( lnk.pindex, ptran );

    // Link's bind isn't really needed, but to ease typescript "error",
    // I need a backup transform because getBone is able to return a null.
    // But the first bone must use the results of the looksolver instead of bind
    ctran.fromMul( ptran, pose.getBone( lnk.index )?.local ?? lnk.bind );

    rot
        .fromAxisAngle( axis, -ang[0] ) // Create opposite direction rotation
        .mul( ctran.rot )               // Apply to current rotation
        .pmulInvert( ptran.rot );       // To Local Space

    pose.setLocalRot( lnk.index, rot );

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // SECOND BONE - REPEAT OF BONE 1
    lnk = chain.links[1];
    pose.getWorldTransform( lnk.pindex, ptran );
    ctran.fromMul( ptran, lnk.bind );   // Use bind here instead of pose

    rot
        .fromAxisAngle( axis, -( Math.PI + ang[1] ) ) // This time needed to be over 180deg to rotate correctly
        .mul( ctran.rot )
        .pmulInvert( ptran.rot );

    pose.setLocalRot( lnk.index, rot );

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // THIRD BONE - REPEAT OF BONE 1

    lnk = chain.links[2];
    pose.getWorldTransform( lnk.pindex, ptran );
    ctran.fromMul( ptran, lnk.bind );

    rot
        .fromAxisAngle( axis, -( Math.PI + ang[2] ) )
        .mul( ctran.rot )
        .pmulInvert( ptran.rot );

    pose.setLocalRot( lnk.index, rot );
}

// http://www.1728.org/quadtrap.htm
function trapezoidCalculator( lbase: number, sbase: number, lleg: number, rleg: number ): Array<number> | null{
    if( lbase < sbase ){ console.log( 'Long Base Must Be Greater Than Short Base' ); return null; };

    // h2= (a+b-c+d)(-a+b+c+d)(a-b-c+d)(a+b-c-d)/(4(a-c))^2
    let h2 = ( lbase + lleg + sbase + rleg ) *
             ( lbase * -1 + lleg + sbase + rleg ) *
             ( lbase - lleg - sbase + rleg ) *
             ( lbase + lleg - sbase - rleg ) /
             ( 4 * ( ( lbase-sbase ) * ( lbase-sbase ) ) );

    if( h2 < 0 ){ console.log( 'A Trapezoid With These Dimensions Cannot Exist' ); return null; };

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // let perim   = lbase + sbase + lleg + rleg;
    // let median  = ( lbase + sbase ) * 0.5;
    let diff    = lbase - sbase;
    let xval    = ( lleg**2 + diff**2 - rleg**2 ) / ( 2 * diff );
    let height  = Math.sqrt( lleg**2 - xval**2 );
    // let area    = height * median;
    let adj     = diff - xval;

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    let angA = Math.atan( height / xval );  // Angle of LBase + LLeg
    if( angA < 0 ) angA = angA + Math.PI;

    let angB = Math.PI - angA;              // Angle of SBase + LLeg

    let angD = Math.atan( height / adj );   // Angle of LBase + RLeg
    if( angD < 0 ) angD = angD + Math.PI;

    let angC = Math.PI - angD;              // Angle of SBase + RLeg

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // let diag1 = ( lbase-xval ) * ( lbase-xval ) + ( height*height ); // bottom left to top right length
    // diag1 = Math.sqrt( diag1 );
    // let diag2 = ( sbase + xval ) * ( sbase + xval ) + (height*height); // bottom right to top left length
    // diag2 = Math.sqrt( diag2 );
    console.log( h2, [ angA, angB, angC, angD ] );
    return [ angA, angB, angC, angD ];
}


function getTrapezoidAngles(a, b, c, d){
    // Calculate the height of the trapezoid using the Pythagorean theorem
    const height = Math.sqrt(c ** 2 + d ** 2);
    // Calculate the angles using trigonometry
    const angleA = Math.asin(a / height);
    const angleB = Math.acos(b / height);
    const angleC = Math.atan(c / b);
    const angleD = Math.atan(d / a);
    // Return the angles in radians
    return [angleA, angleB, angleC, angleD];
  }

function calculateTrapezoidAngles(a, b, c, d){
    // a: left side
    // b: top side
    // c: right side
    // d: bottom side

    function angleBetweenSides(x, y, z) {
        // Using the cosine rule to find the angle opposite to side y
        return Math.acos((x * x + z * z - y * y) / (2 * x * z));
    }

    const angleA = angleBetweenSides(a, b, d); // Angle at the bottom left
    const angleB = angleBetweenSides(b, c, a); // Angle at the top left
    const angleC = angleBetweenSides(c, d, b); // Angle at the bottom right
    const angleD = angleBetweenSides(d, a, c); // Angle at the top right

    // Convert radians to degrees
    const anglesInDegrees = [ angleA, angleB, angleD, angleC ];//.map(angle => angle * (180 / Math.PI));

    return anglesInDegrees;
}

function getTrapezoidAngles2(a, b, c, d){
    // const cosA = (b ** 2 + c ** 2 - a ** 2) / (2 * b * c);
    // const cosB = (a ** 2 + c ** 2 - b ** 2) / (2 * a * c);
    // const cosC = (a ** 2 + b ** 2 - c ** 2) / (2 * a * b);
    // const cosD = (b ** 2 + d ** 2 - a ** 2) / (2 * b * d);
    // return [Math.acos(cosA), Math.acos(cosB), Math.acos(cosC), Math.acos(cosD)];

    const angleA = Math.atan2(Math.sqrt((a ** 2 + b ** 2 - c ** 2) * (a ** 2 + d ** 2 - b ** 2)), (a ** 2 + c ** 2 - d ** 2) * (b ** 2 + c ** 2 - a ** 2));
    const angleB = Math.atan2(Math.sqrt((b ** 2 + c ** 2 - a ** 2) * (b ** 2 + d ** 2 - c ** 2)), (b ** 2 + a ** 2 - d ** 2) * (c ** 2 + d ** 2 - b ** 2));
    const angleC = Math.atan2(Math.sqrt((c ** 2 + d ** 2 - b ** 2) * (c ** 2 + a ** 2 - d ** 2)), (c ** 2 + b ** 2 - a ** 2) * (d ** 2 + a ** 2 - c ** 2));
    const angleD = Math.atan2(Math.sqrt((d ** 2 + a ** 2 - c ** 2) * (d ** 2 + b ** 2 - a ** 2)), (d ** 2 + c ** 2 - b ** 2) * (a ** 2 + b ** 2 - d ** 2));
    return [angleA, angleB, angleC, angleD];
  }


  function getTrapezoidAngles3(a, b, c, d){
    const diagonal1 = Math.sqrt(a ** 2 + b ** 2 - 2 * a * b * Math.cos(Math.PI / 2));
    const diagonal2 = Math.sqrt(c ** 2 + d ** 2 - 2 * c * d * Math.cos(Math.PI / 2));
    const angleSum = 360;
    const equation1 = { coefficient: 1, constant: angleSum };
    const equation2 = { coefficient: 1, constant: 180 };
    const equation3 = { coefficient: 1, constant: 180 };
    const equation4 = { coefficient: 1, constant: 0 };
    const equations = [equation1, equation2, equation3, equation4];
    // Solve the system of linear equations
    const angles = [];
    for (let i = 0; i < 4; i++) {
      const equation = equations[i];
      const coefficient = equation.coefficient;
      const constant = equation.constant;
      angles.push((constant - coefficient * angles[i - 1]) / coefficient);
    }
    return angles;
}

function calculateTrapezoidAngles2(left, top, right, bottom){
    // left: Length of the left side of the trapezoid
    // top: Length of the top side of the trapezoid
    // right: Length of the right side of the trapezoid
    // bottom: Length of the bottom side of the trapezoid

    // Function to calculate an angle using the Law of Cosines
    function angleFromSides(x, y, z) {
        // x, y, z are the lengths of the sides adjacent to the angle
        const angle = Math.acos((x * x + z * z - y * y) / (2 * x * z));
        return angle; // Returns angle in radians
    }

    // Calculate each angle
    const angleBottomLeft = angleFromSides(left, bottom, Math.sqrt(left * left + bottom * bottom)); // Left, Bottom, Hypotenuse
    const angleTopLeft = angleFromSides(top, left, Math.sqrt(top * top + left * left)); // Top, Left, Hypotenuse
    const angleTopRight = angleFromSides(right, top, Math.sqrt(right * right + top * top)); // Right, Top, Hypotenuse
    const angleBottomRight = angleFromSides(bottom, right, Math.sqrt(bottom * bottom + right * right)); // Bottom, Right, Hypotenuse

    // Convert radians to degrees
    const anglesInDegrees = [
        angleBottomLeft, // * (180 / Math.PI),
        angleTopLeft, // * (180 / Math.PI),
        angleTopRight, // * (180 / Math.PI),
        angleBottomRight, // * (180 / Math.PI)
    ];

    return anglesInDegrees;
}


function calculateTrapeziumAngles(left, top, right, bottom){
    // left: Length of the left side
    // top: Length of the top side
    // right: Length of the right side
    // bottom: Length of the bottom side

    // Function to calculate angle at a vertex using the Law of Cosines
    function angleBetweenSides(a, b, c) {
        return Math.acos((a * a + c * c - b * b) / (2 * a * c));
    }

    // Calculate lengths of diagonals using the coordinates method
    // Assuming trapezium coordinates based on provided lengths
    const diagonal1 = Math.sqrt(left * left + (top - bottom) * (top - bottom));
    const diagonal2 = Math.sqrt(right * right + (top - bottom) * (top - bottom));

    // Calculate angles
    const angleA = angleBetweenSides(left, bottom, diagonal1);  // A
    const angleB = angleBetweenSides(top, left, diagonal1);        // B
    const angleC = angleBetweenSides(right, top, diagonal2);      // C
    const angleD = angleBetweenSides(bottom, right, diagonal2); // D

    // Convert radians to degrees
    const anglesInDegrees = [
        angleA, // * (180 / Math.PI),
        angleB, // * (180 / Math.PI),
        angleC, // * (180 / Math.PI),
        angleD, // * (180 / Math.PI)
    ];

    return anglesInDegrees;
}


export default function trapezoidSolver( tar: IKTarget, chain: IKChain, pose: Pose, debug: any ){
    console.log( 'trapezoid' );

    debug.ln.add( tar.startPos, tar.endPos, 0x00ff00 );
    debug.pnt.add( tar.startPos, 0x00ff00, 6 );
    debug.pnt.add( tar.endPos, 0x00ff00, 6 );

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    const ptran = new Transform(); // Parent Bone WS Transform
    const ctran = new Transform(); // Current Bone WS Transform
    let lnk : IKLink;

    // Axis of rotation after LookSolver aligns chain to target
    const axis  = new Vec3().fromCross( tar.twist, tar.swing ).norm();
    const rot   = new Quat();

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    //       Short Side
    //    b  /---------\ c
    //      /           \
    //   a /_____________\ d
    //        Long Side
    //
    //  Bone0=AB, Bone1=BC, Bone2=CD, IK DISTANCE=AD

    const lft_len   = chain.links[0].len;
    const top_len   = chain.links[1].len;
    const rit_len   = chain.links[2].len;
    const bot_len   = tar.dist;
    let ang         : Array< number > | null;


    console.log( "LENGTHS", lft_len, top_len, rit_len, bot_len );

    // if( bot_len >= top_len ){
        // console.log( 'BOTTOM' );
        // ang = trapezoidCalculator( bot_len, top_len, lft_len, rit_len );
        // ang = trapezoidCalculator( top_len, bot_len, rit_len, lft_len );
        // ang = [ ang[ 2 ], ang[ 3 ], ang[ 0 ], ang[ 1 ] ]; // abcd -> cdab

        // ang = calculateTrapezoidAngles( lft_len, top_len, rit_len, bot_len );

        // ang = getTrapezoidAngles( lft_len, top_len, rit_len, bot_len );
        // ang = getTrapezoidAngles( rit_len, bot_len, lft_len, top_len );
        // ang = [ ang[2], ang[3], ang[0], ang[1] ];

        // ang = getTrapezoidAngles2( lft_len, top_len, rit_len, bot_len );
        // ang = getTrapezoidAngles( rit_len, bot_len, lft_len, top_len );
        // ang = [ ang[2], ang[3], ang[0], ang[1] ];
        // ang = [ ang[2], ang[3], ang[0], ang[1] ];

        ang = getTrapezoidAngles3( lft_len, top_len, rit_len, bot_len  );
        // ang = getTrapezoidAngles3( rit_len, bot_len, lft_len, top_len );

        ang = calculateTrapezoidAngles2( lft_len, top_len, rit_len, bot_len  );
        // ang = calculateTrapezoidAngles2( rit_len, bot_len, lft_len, top_len  );
        // ang = [ ang[2], ang[3], ang[0], ang[1] ];

        // ang = calculateTrapeziumAngles( lft_len, top_len, rit_len, bot_len  );
        ang = calculateTrapeziumAngles( rit_len, bot_len, lft_len, top_len  );


    // }else{
    //     console.log( 'TOP' );
    //     ang = calculateTrapezoidAngles( rit_len, bot_len, lft_len, top_len );

    //     // ang = trapezoidCalculator( top_len, bot_len, rit_len, lft_len ); // Middle bone is longer then ik distance
    //     // if( !ang ) return;

    //     // // Since we need to do the computation in reverse to make sure the shortest base it top, longest is bottom
    //     // // Changing the top/bottom changes the order that the rotation values come back.
    //     // // Easy to fix by reordering the array to match what it would be if the IK line is the longer one
    //     // ang = [ ang[ 2 ], ang[ 3 ], ang[ 0 ], ang[ 1 ] ]; // abcd -> cdab
    // }
    console.log( ang, ang.map( x=> x * 180 / Math.PI ), [83, 130, 76 ] );

    // if( ang.includes( NaN ) ){
    //     console.log( 'ang has a NaN value' );
    //     return;
    // }


    // Get Bone's current rotation
    lnk = chain.links[0];
    pose.getWorldTransform( lnk.pindex, ptran );

    // Link's bind isn't really needed, but to ease typescript "error",
    // I need a backup transform because getBone is able to return a null.
    // But the first bone must use the results of the looksolver instead of bind
    ctran.fromMul( ptran, pose.getBone( lnk.index )?.local ?? lnk.bind );

    rot
        // .fromAxisAngle( axis, -ang[1] ) // Create opposite direction rotation
        // .fromAxisAngle( axis, -ang[0] )
        // .fromAxisAngle( axis, -( Math.PI * 0.5 - ang[0] ) )
        .fromAxisAngle( axis, ( -ang[2] ) )
        // .fromAxisAngle( axis, -( 83 * Math.PI / 180 ) )
        // .fromAxisAngle( axis, -( 61 * Math.PI / 180 ) )
        .mul( ctran.rot )               // Apply to current rotation
        .pmulInvert( ptran.rot );       // To Local Space

    pose.setLocalRot( lnk.index, rot );


    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // SECOND BONE - REPEAT OF BONE 1
    lnk = chain.links[1];
    pose.getWorldTransform( lnk.pindex, ptran );
    ctran.fromMul( ptran, lnk.bind );   // Use bind here instead of pose

    rot
        // .fromAxisAngle( axis, -( Math.PI + ang[1] ) )
        // .fromAxisAngle( axis, (  ang[1] + ang[0] ) )
        .fromAxisAngle( axis, ( Math.PI - ang[1] ) )
        // .fromAxisAngle( axis, (  130 * Math.PI / 180 ) )
        // .fromAxisAngle( axis, (  125 * Math.PI / 180 ) )
        .mul( ctran.rot )
        .pmulInvert( ptran.rot );

    pose.setLocalRot( lnk.index, rot );

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // THIRD BONE - REPEAT OF BONE 1

    lnk = chain.links[2];
    pose.getWorldTransform( lnk.pindex, ptran );
    ctran.fromMul( ptran, lnk.bind );

    rot
        // .fromAxisAngle( axis, ( ang[2] ) )
        // .fromAxisAngle( axis, ( Math.PI * 0.5 + ang[2] ) )
        .fromAxisAngle( axis, ( Math.PI - ang[3] ) )
        // .fromAxisAngle( axis, (  76 * Math.PI / 180 ) )
        // .fromAxisAngle( axis, (  110 * Math.PI / 180 ) )
        .mul( ctran.rot )
        .pmulInvert( ptran.rot );

    pose.setLocalRot( lnk.index, rot );



    // lnk = chain.links[3];
    // pose.getWorldTransform( lnk.pindex, ptran );
    // ctran.fromMul( ptran, lnk.bind );
    // debug.pnt.add( ctran.pos, 0xff00ff, 4, 1 );

}