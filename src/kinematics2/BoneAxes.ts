// #region IMPORTS
import type { ConstQuat } from '../maths/Quat';
import Vec3 from '../maths/Vec3';
// #endregion

export default class BoneAxes {
    // #region STATIC
    // SWING-TWIST-ORTHO - What is Forward - Up - Left
    static UFR = 0;     // Aim, Chest, BLENDER LIKE
    static RBD = 1;     // Left Arm
    static LBD = 2;     // Right Arm
    static DFL = 3;     // Legs
    static FUR = 4;     // Standard WorldSpace Dir
    // #endregion

    // #region MAIN
    swing = new Vec3( Vec3.UP );        // Y
    twist = new Vec3( Vec3.FORWARD );   // Z
    ortho = new Vec3( Vec3.RIGHT );     // X

    constructor( axes ?: BoneAxes ){
        if( axes ) this.copy( axes );
    }
    // #endregion

    // #region METHODS

    /** Get new BoneAxes with quaternion applied */
    getFromQuat( q: ConstQuat, rtn = new BoneAxes() ){ return rtn.copy( this ).applyQuat( q ); }

    copy( axes: BoneAxes ): this{
        this.swing.copy( axes.swing );
        this.twist.copy( axes.twist );
        this.ortho.copy( axes.ortho );
        return this;
    }

    /** Apply rotation on current axes directions */
    applyQuat( q: ConstQuat ): this{
        this.swing.fromQuat( q, this.swing ).norm();
        this.twist.fromQuat( q, this.twist ).norm();
        this.ortho.fromQuat( q, this.ortho ).norm();
        return this;
    }

    /** Set a quaternion direction set. For swing-twist ik rotations
     * please make sure the quaternion passed in are inverted first
     * when your looking to support qi axes.
     */
    setQuatDirections( q: ConstQuat, ba=BoneAxes.UFR ){
        switch( ba ){
            case BoneAxes.UFR:
                this.swing.fromQuat( q, Vec3.UP );
                this.twist.fromQuat( q, Vec3.FORWARD );
                this.ortho.fromQuat( q, Vec3.RIGHT );
                break;

            case BoneAxes.RBD:
                this.swing.fromQuat( q, Vec3.RIGHT );
                this.twist.fromQuat( q, Vec3.BACK );
                this.ortho.fromQuat( q, Vec3.DOWN );
                break;

            case BoneAxes.LBD:
                this.swing.fromQuat( q, Vec3.RIGHT );
                this.twist.fromQuat( q, Vec3.BACK );
                this.ortho.fromQuat( q, Vec3.DOWN );
                break;

            case BoneAxes.DFL:
                this.swing.fromQuat( q, Vec3.DOWN );
                this.twist.fromQuat( q, Vec3.FORWARD );
                this.ortho.fromQuat( q, Vec3.LEFT );
                break;

            case BoneAxes.FUR:
                this.swing.fromQuat( q, Vec3.FORWARD );
                this.twist.fromQuat( q, Vec3.UP );
                this.ortho.fromQuat( q, Vec3.RIGHT );
                break;
        }

        this.swing.norm();
        this.twist.norm();
        this.ortho.norm();
        return this;
    }
    // #endregion
}